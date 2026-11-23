// Authenticator-verify shape probe. "Invalid challenge ID." = wrong context.
const E = require('../twofactor');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const b64 = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const [USER, PASS] = process.argv.slice(2);

(async () => {
    const e = new E();
    const p = await e.initiateLogin(USER, PASS);
    if (p.kind !== 'twoFactor') { console.log('not parked:', JSON.stringify(p).slice(0, 200)); return; }
    const s = e.pending2FA.get(p.sessionId);
    const url = `https://twostepverification.roblox.com/v1/users/${s.userId}/challenges/authenticator/verify`;
    const base = { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*', Origin: 'https://www.roblox.com', Referer: 'https://www.roblox.com/login', Cookie: s.jar.header, 'X-CSRF-TOKEN': s.csrf };
    const ch = { 'rblx-challenge-id': s.challengeId, 'rblx-challenge-type': 'twostepverification' };
    const shapes = [
        ['A hdr+bare', { ...ch, 'rblx-challenge-metadata': b64({ actionType: 'Login' }) }, { actionType: 'Login', code: '000000' }],
        ['B hdr+empty', { ...ch, 'rblx-challenge-metadata': b64({}) }, { actionType: 'Login', code: '000000' }],
        ['C body-id', {}, { challengeId: s.challengeId, actionType: 'Login', code: '000000' }],
        ['D bare', {}, { actionType: 'Login', code: '000000' }],
        ['E hdr+id+meta', { ...ch, 'rblx-challenge-metadata': b64({ actionType: 'Login' }) }, { challengeId: s.challengeId, actionType: 'Login', code: '000000' }]
    ];
    for (const [label, hdr, body] of shapes) {
        const r = await fetch(url, { method: 'POST', headers: { ...base, ...hdr }, body: JSON.stringify(body) });
        console.log(`${label.padEnd(14)} ${r.status}  ${(await r.text()).slice(0, 160)}`);
    }
})().catch(err => console.error('FATAL', err.message));
