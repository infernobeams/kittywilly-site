/**
 * VDF probe.
 *
 * Artifacts say N (1024-bit modulus), A (40-bit base), T (400000).
 * A T that small cannot be a hash threshold — the chance of landing under it
 * is nil. It is a squaring count: the solution is A^(2^T) mod N, computed
 * sequentially. That is a verifiable delay function, and it explains why N is
 * a modulus and why A is tiny.
 *
 * This walks the whole handshake and prints the verdict from verify.
 */

const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const jar = new Map();

function absorb(res) {
    const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of list) {
        const pair = raw.split(';')[0];
        const i = pair.indexOf('=');
        if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
}
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

async function login(csrf, extra = {}) {
    const headers = {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        Origin: 'https://www.roblox.com',
        Referer: 'https://www.roblox.com/login',
        Cookie: cookieHeader(),
        ...extra
    };
    if (csrf) headers['X-CSRF-TOKEN'] = csrf;
    const res = await fetch('https://auth.roblox.com/v2/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            ctype: 'Username',
            cvalue: process.argv[2] || 'bench_probe_user',
            password: process.argv[3] || 'ProbePass!123'
        })
    });
    absorb(res);
    return res;
}

function vdf(A, N, T) {
    let acc = A % N;
    for (let i = 0; i < T; i++) acc = (acc * acc) % N;
    return acc;
}

(async () => {
    let res = await login(null);
    const csrf = res.headers.get('x-csrf-token');
    console.log(`hop1 ${res.status} csrf=${csrf}`);

    res = await login(csrf);
    const challengeId = res.headers.get('rblx-challenge-id');
    const type = res.headers.get('rblx-challenge-type');
    const metaRaw = res.headers.get('rblx-challenge-metadata');
    console.log(`hop2 ${res.status} type=${type} id=${challengeId}`);
    console.log(`body=${(await res.text()).slice(0, 200)}`);
    if (!metaRaw) return;

    const meta = JSON.parse(Buffer.from(metaRaw, 'base64').toString('utf8'));
    const sessionId = meta.sessionId;

    const puzzleRes = await fetch(
        `https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle?urlLocale=en_us&sessionID=${encodeURIComponent(sessionId)}`,
        { headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*' } }
    );
    const puzzle = await puzzleRes.json();
    const art = typeof puzzle.artifacts === 'string' ? JSON.parse(puzzle.artifacts) : puzzle.artifacts;

    const N = BigInt(art.N);
    const A = BigInt(art.A);
    const T = Number(art.T);
    console.log(`\ncomputing A^(2^${T}) mod N  (${String(N).length} digit modulus)`);

    const start = Date.now();
    const solution = vdf(A, N, T);
    const ms = Date.now() - start;
    console.log(`done in ${ms}ms`);
    console.log(`solution=${String(solution).slice(0, 80)}… (${String(solution).length} digits)`);

    // The client's GET and POST configs share one URL: /v1/pow-puzzle.
    // GET carries sessionID as a query param, POST carries it in the body.
    // The POST sits behind the same XSRF gate as login, so the first hit is
    // expected to bounce with a token in the header.
    const postVerify = async (csrfToken) => {
        const headers = {
            'User-Agent': UA,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Origin: 'https://www.roblox.com',
            Referer: 'https://www.roblox.com/',
            Cookie: cookieHeader()
        };
        if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken;
        const r = await fetch('https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle', {
            method: 'POST',
            headers,
            body: JSON.stringify({ sessionID: sessionId, solution: String(solution) })
        });
        absorb(r);
        return r;
    };

    let verifyRes = await postVerify(null);
    if (verifyRes.status === 403) {
        const xsrf = verifyRes.headers.get('x-csrf-token');
        console.log(`\nverify gate ${verifyRes.status} xsrf=${xsrf}`);
        await verifyRes.text();
        if (xsrf) verifyRes = await postVerify(xsrf);
    }
    const verifyText = await verifyRes.text();
    console.log(`verify ${verifyRes.status} ${verifyText.slice(0, 300)}`);

    if (verifyRes.status !== 200) {
        console.log('VDF hypothesis rejected — not retrying login.');
        return;
    }

    const continueMeta = Buffer.from(JSON.stringify({
        sessionId,
        solution: String(solution),
        redemptionToken: ''
    }), 'utf8').toString('base64');

    res = await login(csrf, {
        'rblx-challenge-id': challengeId,
        'rblx-challenge-type': 'proofofwork',
        'rblx-challenge-metadata': continueMeta
    });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    console.log(`\nhop3 ${res.status}`);
    console.log(`  type=${res.headers.get('rblx-challenge-type') || '(none)'}`);
    console.log(`  set-cookie=${setCookies.map(c => c.split(';')[0]).join(' | ') || '(none)'}`);
    console.log(`  body=${(await res.text()).slice(0, 400)}`);
})().catch(e => console.error('FATAL', e));
