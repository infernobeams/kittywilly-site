// Proves the two captcha redemption lanes pick the right hop.
// No network: global fetch is stubbed and the requests are inspected.
const Engine = require('../twofactor');

const calls = [];

function stubFetch() {
    global.fetch = async (url, init = {}) => {
        const body = init.body ? JSON.parse(init.body) : null;
        calls.push({ url: String(url), method: init.method || 'GET', body, headers: init.headers || {} });

        const headers = new Map();
        const set = (k, v) => headers.set(k.toLowerCase(), v);
        const isContinue = String(url).includes('/challenge/v1/continue');
        const isLogin = String(url).includes('/v2/login');

        let payload = {};
        let status = 200;

        if (isContinue) {
            set('x-csrf-token', 'csrf-continue');
            payload = { ok: true };
        } else if (isLogin) {
            // Deliberately no cookie and no user: classify() must answer
            // "failed" so the assertion is about the hop, not the outcome.
            set('x-csrf-token', 'csrf-login');
            status = 403;
            payload = { errors: [{ message: 'probe' }] };
        }

        return {
            status,
            headers: {
                get: name => headers.get(String(name).toLowerCase()) ?? null,
                getSetCookie: () => []
            },
            json: async () => payload,
            text: async () => JSON.stringify(payload)
        };
    };
}

async function run() {
    stubFetch();

    const engine = new Engine();

    // Lane A: captchav2 — no blob, token rides on the credential body.
    const a = engine.captchaRelay.stage({
        challengeId: 'challenge-a',
        challengeType: 'captchav2',
        metadata: { unifiedCaptchaId: 'uci-A', actionType: 'Login' },
        jar: new Engine.CookieJar(),
        csrf: 'csrf-a',
        credentials: { ctype: 'Username', cvalue: 'bench', password: 'pw' },
        username: 'bench',
        password: 'pw'
    });

    calls.length = 0;
    const outA = await engine.submitCaptcha(a.captchaId, 'token-'.padEnd(40, 'a'));
    const continueA = calls.filter(c => c.url.includes('/challenge/v1/continue'));
    const loginA = calls.filter(c => c.url.includes('/v2/login'));

    console.log('--- lane A (captchav2, no blob)');
    console.log('continue hops:', continueA.length, '(must be 0)');
    console.log('login hops   :', loginA.length);
    console.log('login body   :', JSON.stringify(loginA[0] && loginA[0].body));
    console.log('result kind  :', outA.kind, '| requiresCaptcha:', outA.requiresCaptcha);

    // Lane B: legacy captcha — blob present, continue then replay with headers.
    const b = engine.captchaRelay.stage({
        challengeId: 'challenge-b',
        challengeType: 'captcha',
        metadata: { dataExchangeBlob: 'blob-B', unifiedCaptchaId: 'uci-B', actionType: 'Login' },
        jar: new Engine.CookieJar(),
        csrf: 'csrf-b',
        credentials: { ctype: 'Username', cvalue: 'bench', password: 'pw' },
        username: 'bench',
        password: 'pw'
    });

    calls.length = 0;
    const outB = await engine.submitCaptcha(b.captchaId, 'token-'.padEnd(40, 'b'));
    const continueB = calls.filter(c => c.url.includes('/challenge/v1/continue'));
    const loginB = calls.filter(c => c.url.includes('/v2/login'));

    console.log('\n--- lane B (legacy captcha, blob present)');
    console.log('continue hops:', continueB.length, '(must be 1)');
    console.log('continue body:', JSON.stringify(continueB[0] && continueB[0].body));
    console.log('login hops   :', loginB.length);
    console.log('login headers:', JSON.stringify({
        'rblx-challenge-id': loginB[0] && loginB[0].headers['rblx-challenge-id'],
        'rblx-challenge-type': loginB[0] && loginB[0].headers['rblx-challenge-type'],
        hasMetadata: Boolean(loginB[0] && loginB[0].headers['rblx-challenge-metadata'])
    }));
    console.log('result kind  :', outB.kind, '| requiresCaptcha:', outB.requiresCaptcha);

    const fail = [];
    if (continueA.length !== 0) fail.push('lane A posted to continue');
    if (!loginA[0] || loginA[0].body.captchaId !== 'uci-A') fail.push('lane A missing captchaId');
    if (!loginA[0] || !loginA[0].body.captchaToken) fail.push('lane A missing captchaToken');
    if (continueB.length !== 1) fail.push('lane B skipped continue');
    if (!loginB[0] || !loginB[0].headers['rblx-challenge-metadata']) fail.push('lane B replay missing challenge metadata');
    if (loginB[0] && loginB[0].body.captchaToken) fail.push('lane B leaked captchaToken into the body');

    console.log('\n' + (fail.length ? 'FAIL: ' + fail.join('; ') : 'PASS — both lanes hop correctly'));
    process.exit(fail.length ? 1 : 0);
}

run().catch(err => {
    console.error('FATAL', err);
    process.exit(1);
});
