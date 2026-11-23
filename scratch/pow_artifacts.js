/**
 * Dump the live proof-of-work artifacts verbatim.
 *
 * The question this answers: what are N, A and T actually shaped like?
 * Bit lengths decide the construction — a 2048-bit N with a small A is
 * modular arithmetic, a 16-hex-digit T is a hash threshold.
 */

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

async function login(csrf) {
    const headers = {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        Origin: 'https://www.roblox.com',
        Referer: 'https://www.roblox.com/login',
        Cookie: cookieHeader()
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

const bits = hex => (hex || '').replace(/^0+/, '').length * 4;

(async () => {
    let res = await login(null);
    const csrf = res.headers.get('x-csrf-token');
    console.log(`hop1 ${res.status} csrf=${csrf}`);

    res = await login(csrf);
    const metaRaw = res.headers.get('rblx-challenge-metadata');
    const type = res.headers.get('rblx-challenge-type');
    console.log(`hop2 ${res.status} type=${type}`);
    await res.text();
    if (!metaRaw) {
        console.log('no challenge metadata');
        return;
    }

    const meta = JSON.parse(Buffer.from(metaRaw, 'base64').toString('utf8'));
    console.log('metadata:', JSON.stringify(meta, null, 2));

    const sessionId = meta.sessionId;
    const url = `https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle?urlLocale=en_us&sessionID=${encodeURIComponent(sessionId)}`;
    const puzzleRes = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*' }
    });
    const puzzleText = await puzzleRes.text();
    console.log(`\npuzzle ${puzzleRes.status}`);
    console.log(puzzleText);

    let puzzle;
    try { puzzle = JSON.parse(puzzleText); } catch { return; }
    const art = typeof puzzle.artifacts === 'string' ? JSON.parse(puzzle.artifacts) : puzzle.artifacts;
    console.log('\nartifact keys:', Object.keys(art || {}));

    for (const [k, v] of Object.entries(art || {})) {
        const s = String(v);
        console.log(`  ${k}: len=${s.length} bits~${bits(s) || 'n/a'} value=${s.slice(0, 90)}${s.length > 90 ? '…' : ''}`);
    }
})().catch(e => console.error('FATAL', e));
