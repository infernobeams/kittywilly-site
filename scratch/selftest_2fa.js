// End-to-end 2FA self-test. Prints one verdict per hop.
//   node scratch/selftest_2fa.js <user> <pass> [code]
// Run from a clean egress. Hop 2 is where a flagged IP dies.

const E = require('../twofactor');
const [USER, PASS, CODE] = process.argv.slice(2);

(async () => {
    const e = new E();
    const jar = new E.CookieJar();

    console.log('1 csrf');
    const csrf = await e.getCsrfToken(jar);
    console.log(`   ${csrf ? 'PASS' : 'FAIL'} (${csrf ? csrf.length + ' chars' : 'none'})`);

    console.log('2 credential + challenge');
    const stage = await e.authenticate(USER, PASS, jar);
    const type = stage.res.headers.get('rblx-challenge-type');
    const tsv = stage.body && stage.body.twoStepVerificationData;
    console.log(`   status ${stage.res.status}  challenge=${type || 'none'}  ticket=${tsv ? 'yes' : 'no'}`);
    if (type && type.startsWith('captcha')) {
        console.log('   DEAD END: captcha on this egress. Not a code fault.');
        return;
    }

    console.log('3 park');
    const parked = await e.classify({ ...stage, username: USER, password: PASS });
    console.log(`   ${parked.kind}  media=${parked.mediaType}  sid=${parked.sessionId || '-'}`);
    if (parked.kind !== 'twoFactor') {
        console.log('   no 2FA ticket -- account may be unenrolled or password rejected');
        return;
    }

    if (!CODE) {
        console.log(`4 verify  SKIPPED (pass a code: node scratch/selftest_2fa.js ${USER} ${PASS} 123456)`);
        return;
    }

    console.log('4 verify relayed to Roblox');
    const out = await e.verify2FACode(parked.sessionId, CODE);
    console.log(`   ${out.valid ? 'PASS' : 'FAIL'}  ${out.message || ''}`);
    if (out.valid) {
        console.log(`5 cookie  ${out.cookie.length} chars  verified=${out.cookieVerified}`);
        const v = await E.validateSessionCookie(out.cookie, e.userAgent);
        console.log(`6 authenticated probe  ${v.state}  user=${v.user ? v.user.name : '-'}`);
    }
})().catch(err => console.error('FATAL', err.message));
