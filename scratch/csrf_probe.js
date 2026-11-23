const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const U = 'https://auth.roblox.com/v2/login';
const B = JSON.stringify({ cvalue: 'definitely_not_a_real_user_zzz', password: 'wrongpass123', type: 'Password' });
const jar = new Map();
const hdr = () => [...jar].map(([k, v]) => k + '=' + v).join('; ');
function absorb(r) {
  const l = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  for (const raw of l) { const p = raw.split(';')[0]; const i = p.indexOf('='); if (i > 0) jar.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); }
  return l;
}
async function post(extra = {}) {
  const r = await fetch(U, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*', Origin: 'https://www.roblox.com', Referer: 'https://www.roblox.com/login', Cookie: hdr(), ...extra }, body: B });
  absorb(r);
  return { status: r.status, csrf: r.headers.get('x-csrf-token'), ctype: r.headers.get('rblx-challenge-type'), cid: r.headers.get('rblx-challenge-id'), meta: (r.headers.get('rblx-challenge-metadata')||'').slice(0,60), text: (await r.text()).slice(0, 200) };
}
(async () => {
  const a = await post();
  console.log('1:', a.status, 'csrf:', !!a.csrf, 'challenge:', a.ctype, 'jar:', [...jar.keys()].join(','));
  const b = await post({ 'X-CSRF-TOKEN': a.csrf });
  console.log('2:', b.status, 'challenge:', b.ctype, 'cid:', b.cid, 'meta:', b.meta);
  const c = await post({ 'X-CSRF-TOKEN': b.csrf || a.csrf });
  console.log('3:', c.status, 'body:', c.text);
})();
