// Lane 2 harness: walks login -> challenge decode -> continue, prints a verdict
// per hop. Run from a clean egress. node scratch/cap_lane2.js <user> <pass>

const E = require('../twofactor');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const [USER, PASS] = process.argv.slice(2);

(async () => {
    const e = new E();
    const jar = new E.CookieJar();
    const s = await e.authenticate(USER, PASS, jar);
    const type = s.res.headers.get('rblx-challenge-type');
    const cid = s.res.headers.get('rblx-challenge-id');
    const raw = s.res.headers.get('rblx-challenge-metadata') || '';
    console.log(`1 login      ${s.res.status}  csrf=${s.csrf ? s.csrf.length : 0}  challenge=${type || 'none'}`);

    if (!type || !type.startsWith('captcha')) {
        console.log('   no captcha gate on this egress -- lane 2 not exercised');
        return;
    }

    const meta = Buffer.from(raw, 'base64').toString('utf8');
    console.log(`2 metadata   ${meta.slice(0, 200)}`);

    for (const host of ['apis.roblox.com', 'auth.roblox.com']) {
        const res = await fetch(`https://${host}/challenge/v1/continue`, {
            method: 'POST',
            headers: {
                'User-Agent': UA,
                'Content-Type': 'application/json',
                Accept: 'application/json, text/plain, */*',
                Origin: 'https://www.roblox.com',
                Referer: 'https://www.roblox.com/login',
                Cookie: jar.header,
                'X-CSRF-TOKEN': s.csrf || '',
                'rblx-challenge-id': cid,
                'rblx-challenge-type': type,
                'rblx-challenge-metadata': raw
            },
            body: JSON.stringify({ challengeId: cid, challengeType: type, challengeMetadata: meta })
        });
        const body = (await res.text()).slice(0, 300);
        console.log(`3 continue   ${host} -> ${res.status}  ${body}`);
    }
})().catch(err => console.error('FATAL', err.message));
