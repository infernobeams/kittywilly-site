const Engine = require('../twofactor');
(async () => {
  const e = new Engine();
  const jar = new Engine.CookieJar();
  const stage = await e.authenticate('indefinitetesting', 'charizardx', jar);
  console.log('status', stage.res.status);
  console.log('challenge-type', stage.res.headers.get('rblx-challenge-type'));
  console.log('--- raw set-cookie ---');
  const raw = stage.res.headers.getSetCookie ? stage.res.headers.getSetCookie() : (stage.res.headers.get('set-cookie') || '').split(/,(?=[^;]+=)/);
  raw.forEach(c => console.log(JSON.stringify(String(c).slice(0, 160))));
  console.log('--- jar keys ---');
  console.log([...jar.map.keys()]);
  console.log('--- jar .ROBLOSECURITY ---');
  console.log(jar.get('.ROBLOSECURITY'));
  const cls = await e.classify({ ...stage, username: 'indefinitetesting', password: 'charizardx' });
  console.log('--- classify ---');
  console.log(JSON.stringify({ kind: cls.kind, valid: cls.valid, cookieLen: (cls.cookie||'').length, allCookieKeys: (cls.allCookies||'').split('; ').map(s=>s.split('=')[0]) }, null, 2));
})();
