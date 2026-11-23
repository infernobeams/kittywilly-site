/** Hit the local auth proxy and print exactly what it returns. */

(async () => {
    const res = await fetch('http://localhost:3000/proxy/roblox/auth.roblox.com/v2/login?urlLocale=en_us', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'bench-harness' },
        body: JSON.stringify({ ctype: 'Username', cvalue: 'bench_proxy_check', password: 'WrongPass!1' })
    });
    const text = await res.text();
    console.log('status:', res.status);
    for (const h of ['content-type', 'x-csrf-token', 'rblx-challenge-id', 'rblx-challenge-type', 'rblx-challenge-metadata', 'set-cookie']) {
        console.log(`  ${h}: ${res.headers.get(h) || '(none)'}`);
    }
    console.log('body:', text.slice(0, 500) || '(empty)');
})();
