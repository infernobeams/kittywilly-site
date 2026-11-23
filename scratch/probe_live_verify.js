/**
 * Live probe: does the parked challenge accept our verify call shape?
 *
 * Sends a deliberately wrong code. A 400/401 with a real error message proves
 * the endpoint, the session and the payload shape are right; a 404/410 proves
 * we are calling a dead route; a 403 on CSRF proves the jar is wrong.
 *
 *   node scratch/probe_live_verify.js <username> <password>
 */

const Engine = require('../twofactor');

const [USER, PASS] = process.argv.slice(2);

(async () => {
    const e = new Engine();
    const jar = new Engine.CookieJar();

    const stage = await e.authenticate(USER, PASS, jar);
    const tsv = stage.body && stage.body.twoStepVerificationData;
    const userId = stage.body && stage.body.user && stage.body.user.id;

    if (!tsv || !tsv.ticket) {
        console.log('no challenge parked:', JSON.stringify(stage.body).slice(0, 300));
        return;
    }
    console.log(`ticket ${tsv.ticket}  media ${tsv.mediaType}  userId ${userId}`);

    const parked = await e.initiateLogin(USER, PASS);
    console.log('parked:', parked.kind, parked.sessionId, 'media:', parked.mediaType);

    const session = e.pending2FA.get(parked.sessionId);
    console.log('session mediaType:', session.mediaType, 'challengeId:', session.challengeId);

    // 1. legacy shape (authenticator = no challengeId in the body)
    const legacy = await e.verifyLegacy(session, '000000');
    console.log('\nlegacy verify :', JSON.stringify(legacy));

    // 2. modern continue shape
    const modern = await e.verifyContinue(session, '000000');
    console.log('modern verify :', JSON.stringify(modern));
})().catch(err => console.error('FATAL', err));
