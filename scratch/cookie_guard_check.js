/**
 * Cookie guard harness.
 *
 * Proves the two properties the 2FA capture now depends on:
 *   1. a short/blank value is never accepted as a session;
 *   2. the anonymous cookie already sitting in the jar is never handed back as
 *      if it were the session that the login just minted.
 *
 * Offline by design — no Roblox call is made.
 */

const Engine = require('../twofactor');

const PREFIX = '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_';
const GUEST = PREFIX + 'G'.repeat(400);
const SESSION = PREFIX + 'S'.repeat(400);

const engine = new Engine();

const res = cookie => new Response('', {
    status: 200,
    headers: { 'set-cookie': `.ROBLOSECURITY=${cookie}; Domain=.roblox.com; Path=/; HttpOnly; Secure` }
});

const cleared = new Response('', {
    status: 200,
    headers: { 'set-cookie': '.ROBLOSECURITY=; Max-Age=0; Path=/' }
});

let failures = 0;
const check = (label, actual, expected) => {
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`- ${label}: ${ok ? 'OK' : `FAIL (got ${JSON.stringify(actual)})`}`);
};

check('blank value rejected', engine.extractSessionCookie(new Response('', { status: 200 })), null);
check('short value rejected', engine.extractSessionCookie(res('abc')), null);
check('cleared value rejected', engine.extractSessionCookie(cleared), null);
check('guest re-issued is rejected', engine.extractSessionCookie(res(GUEST), GUEST), null);
check('fresh session accepted', engine.extractSessionCookie(res(SESSION), GUEST), SESSION);
check('first login has no previous', engine.extractSessionCookie(res(SESSION)), SESSION);

console.log(failures === 0 ? '\nALL CASES PASS' : `\n${failures} CASE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
