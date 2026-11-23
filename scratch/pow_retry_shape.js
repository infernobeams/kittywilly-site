/**
 * Find the retry shape Roblox actually accepts.
 *
 * hop1 CSRF, hop2 challenge, fetch puzzle, compute the VDF, verify, then replay
 * the login with the redemption token in each candidate metadata shape until one
 * gets something other than "Challenge failed to authorize request".
 *
 * A redemption token is single-use, so every candidate gets a fresh challenge.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const USER = process.argv[2] || 'bench_probe_user';
const PASS = process.argv[3] || 'ProbePass!123';

function newJar() { return new Map(); }

function absorb(res, jar) {
    const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of list) {
        const pair = raw.split(';')[0];
        const i = pair.indexOf('=');
        if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
}
const cookieHeader = jar => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

async function login(jar, csrf, extra = {}) {
    const headers = {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        Origin: 'https://www.roblox.com',
        Referer: 'https://www.roblox.com/login',
        Cookie: cookieHeader(jar),
        ...extra
    };
    if (csrf) headers['X-CSRF-TOKEN'] = csrf;
    const res = await fetch('https://auth.roblox.com/v2/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ctype: 'Username', cvalue: USER, password: PASS })
    });
    absorb(res, jar);
    return res;
}

function vdf(A, N, T) {
    let acc = A % N;
    for (let i = 0; i < T; i++) acc = (acc * acc) % N;
    return acc;
}

const b64 = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');

async function oneRun(buildMeta, label) {
    const jar = newJar();

    let res = await login(jar, null);
    const csrf = res.headers.get('x-csrf-token');
    await res.text();
    if (!csrf) return console.log(`${label}: no csrf`);

    res = await login(jar, csrf);
    const id = res.headers.get('rblx-challenge-id');
    const type = res.headers.get('rblx-challenge-type');
    const metaRaw = res.headers.get('rblx-challenge-metadata');
    await res.text();
    if (type !== 'proofofwork') return console.log(`${label}: hop2 type=${type}, stopping`);

    const meta = JSON.parse(Buffer.from(metaRaw, 'base64').toString('utf8'));
    const sid = meta.sessionId;

    const pRes = await fetch(
        `https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle?urlLocale=en_us&sessionID=${encodeURIComponent(sid)}`,
        { headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*' } }
    );
    const puz = await pRes.json();
    const art = typeof puz.artifacts === 'string' ? JSON.parse(puz.artifacts) : puz.artifacts;
    const solution = String(vdf(BigInt(art.A), BigInt(art.N), Number(art.T)));

    const postVerify = async token => {
        const h = {
            'User-Agent': UA,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Origin: 'https://www.roblox.com',
            Referer: 'https://www.roblox.com/',
            Cookie: cookieHeader(jar)
        };
        if (token) h['X-CSRF-TOKEN'] = token;
        const r = await fetch('https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle', {
            method: 'POST', headers: h, body: JSON.stringify({ sessionID: sid, solution })
        });
        absorb(r, jar);
        return r;
    };

    let vr = await postVerify(null);
    if (vr.status === 403) {
        const t = vr.headers.get('x-csrf-token');
        await vr.text();
        if (!t) return console.log(`${label}: verify no xsrf`);
        vr = await postVerify(t);
    }
    const vJson = await vr.json().catch(() => ({}));
    if (!vJson.redemptionToken) return console.log(`${label}: verify ${vr.status} no token`);

    const metaOut = buildMeta({ meta, sid, solution, token: vJson.redemptionToken });

    res = await login(jar, csrf, {
        'rblx-challenge-id': id,
        'rblx-challenge-type': 'proofofwork',
        'rblx-challenge-metadata': b64(metaOut)
    });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const body = await res.text();
    const got = setCookies.some(c => c.includes('.ROBLOSECURITY='));
    console.log(`${label}: ${res.status}${got ? ' SESSION!' : ''} ${body.slice(0, 160)}`);
    if (got) {
        console.log('  >>> WORKING SHAPE:', JSON.stringify(metaOut));
        return true;
    }
    return false;
}

const candidates = [
    ['full echo + token', ({ meta, token }) => ({ ...meta, redemptionToken: token })],
    ['sid + token', ({ sid, token }) => ({ sessionId: sid, redemptionToken: token })],
    ['token only', ({ token }) => ({ redemptionToken: token })],
    ['sid + solution + token', ({ sid, solution, token }) => ({ sessionId: sid, solution, redemptionToken: token })]
];

(async () => {
    for (const [label, build] of candidates) {
        const ok = await oneRun(build, label);
        if (ok) return;
    }
    console.log('\nnone of the shapes worked');
})().catch(e => console.error('FATAL', e));
