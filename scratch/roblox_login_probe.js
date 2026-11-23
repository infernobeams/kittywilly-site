/**
 * Direct probe of Roblox's login endpoint.
 *
 * Runs the CSRF dance by hand so we can see exactly what the proxy has to
 * reproduce: first call, token, cookie, retry, and where the captcha surfaces.
 * Uses deliberately invalid credentials.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function cookieJarFrom(res, jar) {
    const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of list) {
        const pair = raw.split(';')[0];
        const idx = pair.indexOf('=');
        if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
    return jar;
}

function jarHeader(jar) {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function post(label, body, jar, csrf) {
    const headers = {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.roblox.com',
        'Referer': 'https://www.roblox.com/',
    };
    if (csrf) headers['X-CSRF-TOKEN'] = csrf;
    const cookie = jarHeader(jar);
    if (cookie) headers['Cookie'] = cookie;

    const res = await fetch('https://auth.roblox.com/v2/login', { method: 'POST', headers, body: JSON.stringify(body) });
    cookieJarFrom(res, jar);

    const text = await res.text();
    console.log(`\n[${label}] status=${res.status}`);
    console.log(`  x-csrf-token: ${res.headers.get('x-csrf-token') || '(none)'}`);
    console.log(`  rblx-challenge-id: ${res.headers.get('rblx-challenge-id') || '(none)'}`);
    console.log(`  rblx-challenge-type: ${res.headers.get('rblx-challenge-type') || '(none)'}`);
    console.log(`  rblx-challenge-metadata: ${(res.headers.get('rblx-challenge-metadata') || '(none)').slice(0, 120)}`);
    console.log(`  set-cookie: ${(res.headers.getSetCookie ? res.headers.getSetCookie() : []).map(c => c.split(';')[0]).join(' | ') || '(none)'}`);
    console.log(`  body: ${text.slice(0, 400)}`);
    return { status: res.status, csrf: res.headers.get('x-csrf-token'), body: text };
}

(async () => {
    const jar = new Map();
    const creds = { cvalue: 'bench_probe_user', password: 'ProbePass!123', captchaToken: '', captchaProvider: 'PROVIDER_ARKOSE_LABS' };

    const first = await post('attempt 1 (no token)', creds, jar);
    if (first.csrf) {
        await post('attempt 2 (with token)', creds, jar, first.csrf);
    } else {
        console.log('\nNo CSRF token returned — nothing to retry with.');
    }
})().catch(e => console.error('FATAL', e.message));
