/**
 * Live probe: which request shape does the authenticator verifier accept?
 *
 * Tries the four plausible shapes against one freshly parked challenge and
 * prints the message from each. "Incorrect code"-style messages mean the shape
 * is right; "Invalid challenge ID" means the challenge context never arrived.
 *
 *   node scratch/probe_live_verify2.js <username> <password>
 */

const Engine = require('../twofactor');

const [USER, PASS] = process.argv.slice(2);
const b64 = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const call = async (label, url, headers, body) => {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'User-Agent': UA,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            Origin: 'https://www.roblox.com',
            Referer: 'https://www.roblox.com/login',
            ...headers
        },
        body: JSON.stringify(body)
    });
    const text = await res.text();
    console.log(`${label.padEnd(28)} ${res.status}  ${text.slice(0, 220)}`);
    return res;
};

(async () => {
    const e = new Engine();
    const parked = await e.initiateLogin(USER, PASS);
    if (parked.kind !== 'twoFactor') {
        console.log('not parked:', JSON.stringify(parked).slice(0, 300));
        return;
    }

    const s = e.pending2FA.get(parked.sessionId);
    const base = `${'https://twostepverification.roblox.com'}/v1/users/${s.userId}/challenges/authenticator/verify`;
    console.log(`userId ${s.userId}  ticket ${s.challengeId}  media ${s.mediaType}\n`);
    console.log('jar cookies :', [...s.jar.map.keys()].join(', ') || '(none)');
    console.log('csrf        :', s.csrf ? `${String(s.csrf).length} chars` : '(none)');
    console.log('');

    const challengeHeaders = {
        'rblx-challenge-id': s.challengeId,
        'rblx-challenge-type': 'twostepverification',
        'rblx-challenge-metadata': b64({ actionType: 'Login' })
    };
    const cookieHeader = s.jar.header;
    const withJar = cookieHeader ? { Cookie: cookieHeader, 'X-CSRF-TOKEN': s.csrf || '' } : { 'X-CSRF-TOKEN': s.csrf || '' };

    await call('A body only', base, withJar, { actionType: 'Login', code: '000000' });
    await call('B body+challengeId', base, withJar, { challengeId: s.challengeId, actionType: 'Login', code: '000000' });
    await call('C headers+body', base, { ...withJar, ...challengeHeaders }, { actionType: 'Login', code: '000000' });
    await call('D headers+body+id', base, { ...withJar, ...challengeHeaders }, { challengeId: s.challengeId, actionType: 'Login', code: '000000' });
})().catch(err => console.error('FATAL', err));
