/**
 * Live probe: what does Roblox actually answer for these credentials?
 *
 * Prints the verdict, the challenge headers, and the parsed body so the flow
 * can be fixed against reality instead of assumptions.
 *
 *   node scratch/probe_live_login.js <username> <password>
 */

const Engine = require('../twofactor');

const [USER, PASS] = process.argv.slice(2);

(async () => {
    const e = new Engine();
    const jar = new Engine.CookieJar();

    const stage = await e.authenticate(USER, PASS, jar);

    console.log('status        :', stage.res.status);
    for (const h of ['rblx-challenge-id', 'rblx-challenge-type', 'rblx-challenge-metadata', 'x-csrf-token']) {
        const v = stage.res.headers.get(h);
        if (v) console.log(h.padEnd(24) + ':', v.slice(0, 160));
    }

    const setCookies = stage.res.headers.getSetCookie ? stage.res.headers.getSetCookie() : [];
    console.log('set-cookie names:', setCookies.map(c => c.split('=')[0]).join(', ') || '(none)');

    console.log('body          :', JSON.stringify(stage.body).slice(0, 700));

    const classified = await e.classify({ ...stage, username: USER, password: PASS });
    console.log('\nclassified    :', JSON.stringify({
        kind: classified.kind,
        valid: classified.valid,
        requiresTwoFactor: classified.requiresTwoFactor,
        requiresCaptcha: classified.requiresCaptcha,
        mediaType: classified.mediaType,
        userId: classified.userId,
        sessionId: classified.sessionId,
        cookieLen: classified.cookie ? classified.cookie.length : null,
        cookieVerified: classified.cookieVerified,
        message: classified.message
    }));
})().catch(err => console.error('FATAL', err));
