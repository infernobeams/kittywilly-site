// scratch/probe-login.js — one attempt against the engine, no secrets printed.
require('dotenv').config();
const TwoFactorHandler = require('../twofactor');

(async () => {
    const engine = new TwoFactorHandler();
    const username = process.argv[2];
    const password = process.argv[3];
    if (!username || !password) {
        console.error('usage: node scratch/probe-login.js <user> <pass>');
        process.exit(1);
    }
    console.log('[probe] initiating as', username);
    const started = Date.now();
    try {
        const result = await engine.initiateLogin(username, password);
        const summary = {
            elapsedMs: Date.now() - started,
            kind: result && result.kind,
            valid: Boolean(result && result.valid),
            requiresTwoFactor: Boolean(result && result.requiresTwoFactor),
            requiresCaptcha: Boolean(result && result.requiresCaptcha),
            captchaKind: result && (result.captchaKind || result.challengeType || null),
            hasCookie: Boolean(result && result.cookie),
            mediaType: result && result.mediaType,
            message: result && result.message,
            status: result && result.status
        };
        console.log('[probe] result', JSON.stringify(summary, null, 2));
    } catch (err) {
        console.log('[probe] threw', err && err.message);
    }
    process.exit(0);
})();
