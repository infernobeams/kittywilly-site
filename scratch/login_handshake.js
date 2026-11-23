/**
 * Full login handshake, by hand.
 *
 * Reconstructed from a real browser session:
 *
 *   POST auth.roblox.com/v2/login            -> 403 + csrf
 *   POST auth.roblox.com/v2/login            -> 403 + proofofwork challenge
 *   GET  apis.../proof-of-work-service/v1/pow-puzzle        -> N, A, T
 *   POST apis.../proof-of-work-service/v1/pow-puzzle        -> {answerCorrect, redemptionToken}
 *   POST apis.roblox.com/challenge/v1/continue              -> redeem the challenge
 *   POST auth.roblox.com/v2/login  (+ rblx-challenge-*)     -> 200 + .ROBLOSECURITY
 *
 * N is a 1024-bit modulus, A a small base, T a squaring count: the solution is
 * A^(2^T) mod N, a verifiable delay function.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const USER = process.argv[2] || 'bench_probe_user';
const PASS = process.argv[3] || 'ProbePass!123';

const jar = new Map();
const absorb = res => {
    const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of list) {
        const pair = raw.split(';')[0];
        const i = pair.indexOf('=');
        if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
};
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

const baseHeaders = () => ({
    'User-Agent': UA,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://www.roblox.com',
    Referer: 'https://www.roblox.com/login',
    Cookie: cookieHeader()
});

async function login(csrf, extra = {}) {
    const headers = { ...baseHeaders(), ...extra };
    if (csrf) headers['X-CSRF-TOKEN'] = csrf;
    const res = await fetch('https://auth.roblox.com/v2/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ctype: 'Username', cvalue: USER, password: PASS })
    });
    absorb(res);
    return res;
}

// Generic POST that clears the XSRF gate the way the client does.
async function post(url, body, csrf) {
    const send = async token => {
        const headers = { ...baseHeaders() };
        if (token) headers['X-CSRF-TOKEN'] = token;
        const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        absorb(r);
        return r;
    };
    let res = await send(csrf);
    if (res.status === 403) {
        const fresh = res.headers.get('x-csrf-token');
        await res.text();
        if (fresh) res = await send(fresh);
    }
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
    await res.text();
    console.log(`hop1 ${res.status} csrf=${csrf}`);
    if (!csrf) return;

    res = await login(csrf);
    const challengeId = res.headers.get('rblx-challenge-id');
    const challengeType = res.headers.get('rblx-challenge-type');
    const metaRaw = res.headers.get('rblx-challenge-metadata');
    await res.text();
    console.log(`hop2 ${res.status} type=${challengeType} id=${challengeId}`);
    if (challengeType !== 'proofofwork') {
        console.log(`  not a proof-of-work challenge — ${challengeType}`);
        return;
    }

    const meta = JSON.parse(Buffer.from(metaRaw, 'base64').toString('utf8'));
    const sessionId = meta.sessionId;

    const pRes = await fetch(
        `https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle?urlLocale=en_us&sessionID=${encodeURIComponent(sessionId)}`,
        { headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*' } }
    );
    const puzzle = await pRes.json();
    const art = typeof puzzle.artifacts === 'string' ? JSON.parse(puzzle.artifacts) : puzzle.artifacts;
    console.log(`puzzle ${pRes.status} N=${String(art.N).length}d A=${art.A} T=${art.T}`);

    const started = Date.now();
    const solution = String(vdf(BigInt(art.A), BigInt(art.N), Number(art.T)));
    console.log(`vdf done in ${Date.now() - started}ms, ${solution.length} digits`);

    const vRes = await post(
        'https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle',
        { sessionID: sessionId, solution },
        csrf
    );
    const vJson = await vRes.json().catch(() => ({}));
    console.log(`verify ${vRes.status} answerCorrect=${vJson.answerCorrect} token=${vJson.redemptionToken}`);
    if (!vJson.redemptionToken) return;

    const challengeMetadata = JSON.stringify({
        redemptionToken: vJson.redemptionToken,
        sessionId
    });

    const cRes = await post(
        'https://apis.roblox.com/challenge/v1/continue',
        { challengeId, challengeType: 'proofofwork', challengeMetadata },
        csrf
    );
    const cText = await cRes.text();
    console.log(`continue ${cRes.status} ${cText.slice(0, 200)}`);

    const retryMeta = Buffer.from(challengeMetadata, 'utf8').toString('base64');
    res = await login(csrf, {
        'rblx-challenge-id': challengeId,
        'rblx-challenge-type': 'proofofwork',
        'rblx-challenge-metadata': retryMeta
    });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const issued = setCookies.find(c => c.includes('.ROBLOSECURITY='));
    const text = await res.text();

    console.log(`\nhop3 ${res.status}`);
    console.log(`  type=${res.headers.get('rblx-challenge-type') || '(none)'}`);
    console.log(`  cookies=${setCookies.map(c => c.split(';')[0].split('=')[0]).join(', ') || '(none)'}`);
    console.log(`  body=${text.slice(0, 400)}`);

    if (issued) {
        const value = issued.match(/\.ROBLOSECURITY=([^;]+)/)[1];
        console.log(`\n  .ROBLOSECURITY ISSUED — ${value.length} chars`);
        console.log(`  preview ${value.slice(0, 50)}…${value.slice(-10)}`);
    }
})().catch(e => console.error('FATAL', e));
