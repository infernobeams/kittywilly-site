const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const URL = 'https://auth.roblox.com/v2/login';
const body = JSON.stringify({ ctype: 'Username', cvalue: 'indefinitetesting', password: 'wrongpassword_zzz' });

function jarFrom(res, jar) {
    const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of list) {
        const pair = raw.split(';')[0];
        const i = pair.indexOf('=');
        if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    return list;
}
const jarToHeader = jar => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

async function post(jar, extra = {}) {
    const headers = {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        Origin: 'https://www.roblox.com',
        Referer: 'https://www.roblox.com/login',
        Cookie: jarToHeader(jar),
        ...extra
    };
    const res = await fetch(URL, { method: 'POST', headers, body });
    const setCookies = jarFrom(res, jar);
    const text = await res.text();
    return { res, setCookies, text };
}

(async () => {
    const jar = new Map();
    const first = await post(jar);
    console.log('FIRST', first.res.status, 'csrf=', first.res.headers.get('x-csrf-token'), 'challenge=', first.res.headers.get('rblx-challenge-type'), 'set-cookie=', first.setCookies, 'body=', first.text.slice(0, 200));

    const csrf = first.res.headers.get('x-csrf-token');
    if (csrf) {
        const second = await post(jar, { 'X-CSRF-TOKEN': csrf });
        console.log('SECOND', second.res.status, 'csrf=', second.res.headers.get('x-csrf-token'), 'challenge=', second.res.headers.get('rblx-challenge-type'), 'set-cookie=', second.setCookies, 'body=', second.text.slice(0, 300));
    }
})();
