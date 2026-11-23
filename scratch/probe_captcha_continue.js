/**
 * What does challenge/v1/continue return for a captchav2 challenge?
 *
 * The captchav2 metadata carries no Arkose key and no blob, so the widget
 * parameters have to come from the continue handshake. This proves whether they
 * do, and prints the shape so the relay can be written against it.
 *
 *   node scratch/probe_captcha_continue.js <username> <password>
 */

const Engine = require('../twofactor');

const [USER, PASS] = process.argv.slice(2);

(async () => {
    const e = new Engine();
    const jar = new Engine.CookieJar();
    const stage = await e.authenticate(USER, PASS, jar);

    const type = stage.res.headers.get('rblx-challenge-type');
    const challengeId = stage.res.headers.get('rblx-challenge-id');
    console.log('login status:', stage.res.status, '| type:', type);

    if (!challengeId) {
        console.log('no challenge. body:', JSON.stringify(stage.body).slice(0, 300));
        return;
    }

    const raw = stage.res.headers.get('rblx-challenge-metadata');
    const meta = raw ? Buffer.from(raw, 'base64').toString('utf8') : '{}';

    for (const challengeType of [type, 'captcha']) {
        const out = await Engine.CookieJar
            ? null
            : null;
        void out;
        try {
            const res = await fetch('https://apis.roblox.com/challenge/v1/continue', {
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Content-Type': 'application/json',
                    Accept: 'application/json, text/plain, */*',
                    Origin: 'https://www.roblox.com',
                    Referer: 'https://www.roblox.com/login',
                    Cookie: jar.header,
                    'X-CSRF-TOKEN': stage.csrf || ''
                },
                body: JSON.stringify({ challengeId, challengeType, challengeMetadata: meta })
            });
            const text = await res.text();
            console.log(`\n--- challengeType ${challengeType} -> ${res.status}`);
            console.log(text.slice(0, 1200));
        } catch (err) {
            console.log(`\n--- challengeType ${challengeType} -> ERR ${err.message}`);
        }
    }
})().catch(err => console.error('FATAL', err));
