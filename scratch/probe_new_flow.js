const Engine = require('../twofactor');
(async () => {
  const e = new Engine();
  const t0 = Date.now();
  const r = await e.initiateLogin('indefinitetesting', 'charizardx');
  console.log('elapsed', Date.now() - t0, 'ms');
  console.log('kind:', r.kind);
  console.log('requiresTwoFactor:', r.requiresTwoFactor);
  console.log('mediaType:', r.mediaType);
  console.log('userId:', r.userId);
  console.log('sessionId:', r.sessionId ? r.sessionId.slice(0, 12) + '...' : null);
  console.log('message:', r.message);
  console.log('valid:', r.valid, 'cookie:', r.cookie ? r.cookie.length : 0);
  if (r.sessionId) {
    const bad = await e.verify2FACode(r.sessionId, '000000');
    console.log('--- wrong code path ---');
    console.log(JSON.stringify(bad));
  }
})();
