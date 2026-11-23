/**
 * Decode the live captcha challenge metadata in full.
 *
 * One credential POST, one print. The captchav2 shape nests its Arkose
 * parameters somewhere inside the metadata and the keys have to be read, not
 * guessed.
 *
 *   node scratch/probe_captcha_meta.js <username> <password>
 */

const Engine = require('../twofactor');

const [USER, PASS] = process.argv.slice(2);

(async () => {
    const e = new Engine();
    const jar = new Engine.CookieJar();
    const stage = await e.authenticate(USER, PASS, jar);

    console.log('status:', stage.res.status);
    const type = stage.res.headers.get('rblx-challenge-type');
    const raw = stage.res.headers.get('rblx-challenge-metadata');
    console.log('type  :', type);
    console.log('challengeId:', stage.res.headers.get('rblx-challenge-id'));

    if (!raw) {
        console.log('no metadata; body:', JSON.stringify(stage.body).slice(0, 400));
        return;
    }

    let meta;
    try {
        meta = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch (err) {
        console.log('decode failed:', err.message, raw.slice(0, 120));
        return;
    }

    console.log('\n--- metadata keys ---');
    for (const [k, v] of Object.entries(meta)) {
        const preview = typeof v === 'object' && v ? JSON.stringify(v).slice(0, 120) : String(v).slice(0, 120);
        console.log(`  ${k}: ${preview}`);
    }

    const walk = (obj, path = '') => {
        for (const [k, v] of Object.entries(obj || {})) {
            const p = path ? `${path}.${k}` : k;
            if (v && typeof v === 'object') walk(v, p);
            else console.log(`  ${p} = ${String(v).slice(0, 90)}`);
        }
    };
    console.log('\n--- flattened ---');
    walk(meta);
})().catch(err => console.error('FATAL', err));
