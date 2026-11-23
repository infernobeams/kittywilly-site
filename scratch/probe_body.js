const Engine = require('../twofactor');
(async () => {
  const e = new Engine();
  const jar = new Engine.CookieJar();
  const stage = await e.authenticate('indefinitetesting', 'charizardx', jar);
  console.log('status', stage.res.status);
  console.log('headers:');
  for (const [k, v] of stage.res.headers.entries()) console.log('  ', k, '=', String(v).slice(0, 200));
  console.log('body:');
  console.log(JSON.stringify(stage.body, null, 2).slice(0, 1500));
})();
