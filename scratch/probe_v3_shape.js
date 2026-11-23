const Engine = require('../twofactor');
const crypto = require('crypto');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
(async () => {
  const e = new Engine();
  const jar = new Engine.CookieJar();
  const stage = await e.authenticate('indefinitetesting', 'charizardx', jar);
  const tsv = stage.body.twoStepVerificationData;
  console.log('ticket', tsv.ticket, 'media', tsv.mediaType, 'user', stage.body.user.id);

  // same intent path the engine uses, exercised through the public helper
  const nonceRes = await fetch('https://apis.roblox.com/hba-service/v1/getServerNonce', { headers: { 'User-Agent': UA, Accept: 'application/json', Cookie: jar.header } });
  const nonce = (await nonceRes.json());
  const subtle = crypto.webcrypto.subtle;
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign','verify']);
  const pub = Buffer.from(await subtle.exportKey('spki', kp.publicKey)).toString('base64');
  const ts = Math.floor(Date.now()/1000);
  const sig = Buffer.from(await subtle.sign({ name:'ECDSA', hash:{name:'SHA-256'} }, kp.privateKey, Buffer.from(`${pub}|${ts}|${nonce}`,'utf8'))).toString('base64');
  const intent = { clientPublicKey: pub, clientEpochTimestamp: ts, serverNonce: nonce, saiSignature: sig };
  console.log('intent built, nonce len', String(nonce).length, 'pub len', pub.length);

  const url = `https://auth.roblox.com/v3/users/${stage.body.user.id}/two-step-verification/login`;
  const res = await fetch(url, { method:'POST', headers:{ 'User-Agent':UA,'Content-Type':'application/json',Accept:'application/json, text/plain, */*',Origin:'https://www.roblox.com',Referer:'https://www.roblox.com/login','X-CSRF-TOKEN':stage.csrf||'',Cookie:jar.header }, body: JSON.stringify({ challengeId: tsv.ticket, verificationToken: 'bogus-token-probe', rememberDevice: true, accountBlob: '', secureAuthenticationIntent: intent }) });
  console.log('v3 status', res.status);
  console.log('v3 body', (await res.text()).slice(0, 400));
})();
