// c:\Users\acedi\OneDrive\Desktop\New folder\scratch\test-2fa-flow.js
// JavaScript / scratch/test-2fa-flow.js / Node.js 18+
//
// Stage-by-stage harness for the Roblox auth engine. Run it before and after
// enabling 2FA on the test account so both branches are proven:
//
//   node scratch/test-2fa-flow.js indefinitetesting charizardx
//
// Branch A (no 2FA) must print `stage: authenticated` and a cookie length.
// Branch B (2FA on)  must print `stage: verification-required`, then prompt for
// the code Roblox e-mails, then print `stage: authenticated`.
//
// The cookie is printed in full — it is the artifact this whole flow exists to
// produce, and this script only ever runs against an account you control.

const readline = require('readline/promises');
const { stdin, stdout } = require('process');

const RobloxAuthEngine = require('../twofactor');

const USERNAME = process.argv[2] || 'indefinitetesting';
const PASSWORD = process.argv[3] || 'charizardx';

function line(label, value) {
    console.log(`  ${label.padEnd(18)} ${value}`);
}

function fail(message) {
    console.log(`\n[FAIL] ${message}\n`);
    process.exitCode = 1;
}

async function main() {
    const engine = new RobloxAuthEngine();

    console.log('\n=== roblox auth engine : credential stage ===');
    line('username', USERNAME);
    line('password', PASSWORD);

    const started = Date.now();
    const result = await engine.initiateLogin(USERNAME, PASSWORD);
    line('elapsed', `${Date.now() - started}ms`);

    if (result.requiresTwoFactor) {
        console.log('  stage              verification-required');
        line('sessionId', result.sessionId);
        line('mediaType', result.mediaType);
        line('userId', result.userId);
        line('message', result.message);

        const rl = readline.createInterface({ input: stdin, output: stdout });
        const code = (await rl.question('\n  => enter the 6-digit code: ')).trim();
        rl.close();

        if (!/^\d{4,12}$/.test(code)) {
            fail(`"${code}" is not a code.`);
            return;
        }

        console.log('\n=== roblox auth engine : code relay stage ===');
        const verifyStarted = Date.now();
        const verified = await engine.verify2FACode(result.sessionId, code);
        line('elapsed', `${Date.now() - verifyStarted}ms`);

        if (!verified.valid) {
            fail(verified.message || 'verification rejected');
            return;
        }

        console.log('  stage              authenticated');
        line('userId', verified.user && verified.user.id);
        line('displayName', verified.user && verified.user.displayName);
        line('cookieLength', (verified.cookie || '').length);
        line('allCookieCount', (verified.allCookies || '').split(';').length);
        line('twoFactorCode', verified.twoFactorCode);
        console.log('\n  .ROBLOSECURITY');
        console.log(`  ${verified.cookie}`);
        console.log('\n[PASS] 2FA branch: code relayed, session issued.\n');
        return;
    }

    if (result.requiresCaptcha) {
        console.log('  stage              captcha-required');
        line('message', result.message);
        console.log('\n[HOLD] Roblox served an interactive captcha. Set CAPTCHA_API_KEY');
        console.log('       in .env (already populated) and confirm the 2captcha balance.\n');
        return;
    }

    if (!result.valid) {
        fail(result.message || 'credentials rejected');
        return;
    }

    console.log('  stage              authenticated');
    line('userId', result.user && result.user.id);
    line('displayName', result.user && result.user.displayName);
    line('cookieLength', (result.cookie || '').length);
    console.log('\n  .ROBLOSECURITY');
    console.log(`  ${result.cookie}`);
    console.log('\n[PASS] no-2FA branch: session issued.\n');
}

main().catch(err => {
    console.error('\n[FAIL] unhandled:', err && err.stack ? err.stack : err, '\n');
    process.exitCode = 1;
});
