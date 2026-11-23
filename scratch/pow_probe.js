/**
 * Proof-of-work challenge probe.
 *
 * Walks Roblox's login challenge by hand: capture the challenge, fetch the
 * puzzle, solve it, verify it, then retry the login with the solution.
 * Prints every hop so the proxy can be written against what actually happens
 * instead of a guess.
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
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.roblox.com',
        'Referer': 'https://www.roblox.com/login',
        Cookie: cookieHeader(),
        ...extra
    };
    if (csrf) headers['X-CSRF-TOKEN'] = csrf;
    const res = await fetch('https://auth.roblox.com/v2/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ctype: 'Username', cvalue: 'bench_probe_user', password: 'ProbePass!123' })
    });
    absorb(res);
    return res;
}

function sha256Hex(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

(async () => {
    // hop 1 — get a CSRF token
    let res = await login(null);
    let csrf = res.headers.get('x-csrf-token');
    console.log(`hop1 status=${res.status} csrf=${csrf}`);

    // hop 2 — validate the token, receive the challenge
    res = await login(csrf);
    const challengeType = res.headers.get('rblx-challenge-type');
    const challengeId = res.headers.get('rblx-challenge-id');
    const metaRaw = res.headers.get('rblx-challenge-metadata');
    console.log(`hop2 status=${res.status} type=${challengeType} id=${challengeId}`);
    console.log(`body=${(await res.text()).slice(0, 200)}`);

    if (!metaRaw) { console.log('no metadata, stopping'); return; }

    const meta = JSON.parse(Buffer.from(metaRaw, 'base64').toString('utf8'));
    console.log('metadata:', JSON.stringify(meta, null, 2));

    const sessionId = meta.sessionId;
    const puzzleUrl = `https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle?urlLocale=en_us&sessionID=${encodeURIComponent(sessionId)}`;
    const puzzleRes = await fetch(puzzleUrl, { headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*' } });
    const puzzleText = await puzzleRes.text();
    console.log(`\npuzzle status=${puzzleRes.status}`);
    console.log(`puzzle body=${puzzleText.slice(0, 600)}`);

    let puzzle;
    try { puzzle = JSON.parse(puzzleText); } catch (e) { console.log('puzzle not json'); return; }

    const artifacts = typeof puzzle.artifacts === 'string' ? JSON.parse(puzzle.artifacts) : puzzle.artifacts;
    console.log('artifacts:', JSON.stringify(artifacts, null, 2));

    if (!artifacts || !artifacts.N || !artifacts.A || !artifacts.T) {
        console.log('unexpected artifact shape, stopping');
        return;
    }

    // hashcash: find x where sha256(A + x) < T
    const A = BigInt(artifacts.A);
    const T = BigInt(artifacts.T);
    console.log(`N=${artifacts.N} T=${T.toString(16)} (hex)`);

    const start = Date.now();
    let solution = null;
    for (let x = 0n; x < 5000000n; x++) {
        const hex = sha256Hex((A + x).toString());
        if (BigInt('0x' + hex) < T) { solution = x; break; }
        if (x % 200000n === 0n && x > 0n) process.stdout.write('.');
    }
    console.log(`\nsolved in ${Date.now() - start}ms solution=${solution}`);

    if (solution === null) { console.log('no solution'); return; }

    // verify
    const verifyRes = await fetch(
        `https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle/verify?urlLocale=en_us&sessionID=${encodeURIComponent(sessionId)}`,
        {
            method: 'POST',
            headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ solution: solution.toString() })
        }
    );
    const verifyText = await verifyRes.text();
    console.log(`verify status=${verifyRes.status} body=${verifyText.slice(0, 300)}`);

    if (verifyRes.status !== 200) return;

    // retry login carrying the solved challenge
    const continueMeta = Buffer.from(JSON.stringify({
        sessionId,
        solution: solution.toString(),
        redemptionToken: ''
    }), 'utf8').toString('base64');

    res = await login(csrf, {
        'rblx-challenge-id': challengeId,
        'rblx-challenge-type': 'proofofwork',
        'rblx-challenge-metadata': continueMeta
    });
    console.log(`\nhop3 status=${res.status}`);
    console.log(`  type=${res.headers.get('rblx-challenge-type') || '(none)'}`);
    console.log(`  set-cookie=${(res.headers.getSetCookie ? res.headers.getSetCookie() : []).map(c => c.split(';')[0]).join(' | ') || '(none)'}`);
    console.log(`  body=${(await res.text()).slice(0, 400)}`);
})().catch(e => console.error('FATAL', e));
