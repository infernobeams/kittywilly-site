const Engine = require('../twofactor');
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64');
(async () => {
  const e = new Engine();
  const jar = new Engine.CookieJar();
  const stage = await e.authenticate('indefinitetesting', 'charizardx', jar);
  const tsv = stage.body && stage.body.twoStepVerificationData;
  const userId = stage.body && stage.body.user && stage.body.user.id;
  console.log('ticket:', tsv && tsv.ticket, 'media:', tsv && tsv.mediaType, 'userId:', userId);

  const url = `https://twostepverification.roblox.com/v1/users/${userId}/challenges/authenticator/verify`;
  const h = {
    'User-Agent': e.userAgent,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://www.roblox.com',
    Referer: 'https://www.roblox.com/login',
    'X-CSRF-TOKEN': stage.csrf || '',
    Cookie: jar.header
  };
  let r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify({ challengeId: tsv.ticket, actionType: 'Login', code: '000000' }) });
  console.log('legacy verify status', r.status);
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  sc.forEach(c => console.log('  cookie:', c.split(';')[0]));
  console.log('body:', (await r.text()).slice(0, 400));

  // modern continue shape
  const h2 = { ...h, 'rblx-challenge-id': tsv.ticket, 'rblx-challenge-type': 'twostepverification', 'rblx-challenge-metadata': b64({ actionType: 'Login', code: '000000' }) };
  let r2 = await fetch('https://apis.roblox.com/challenge/v1/continue', { method: 'POST', headers: h2, body: JSON.stringify({ challengeId: tsv.ticket, challengeType: 'twostepverification', challengeMetadata: JSON.stringify({ actionType: 'Login', code: '000000' }) }) });
  console.log('continue status', r2.status);
  console.log('continue body:', (await r2.text()).slice(0, 400));
})();
