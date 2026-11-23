// c:\Users\acedi\OneDrive\Desktop\New folder\captcha-relay.js
// JavaScript / captcha-relay.js / Node.js 18+
//
// Self-hosted Arkose relay. No solver service, no API key, no billing.
//
// Roblox gates a login behind `rblx-challenge-type: captcha` carrying a base64
// metadata blob: { publicKey, dataExchangeBlob, unifiedCaptchaId, actionType }.
// Roblox's own client then loads Arkose's enforcement script with the same path
// we use here —
//
//     https://<enforcement>/fc/<publicKey>/captcha.js?<ts>
//
// — with a data-callback attribute, and the Arkose API hands back an enforcement
// object. Roblox configures it as:
//
//     enforcement.setConfig({
//       selector, mode: 'inline' | 'lightbox', styleTheme,
//       data: { blob: dataExchangeBlob },
//       onCompleted: e => captchaToken = e.token
//     })
//
// The blob is what binds the challenge to the specific login attempt, so a token
// minted without it is rejected upstream. This module stages the challenge and
// hands the browser everything needed to run that widget; the browser posts the
// token back through /api/auth/captcha-solved, and the engine redeems it against
// apis.roblox.com/challenge/v1/continue.
//
// The session store is deliberately separate from the 2FA store: a captcha
// outlives a mistyped password but dies with the login attempt.

const crypto = require('crypto');

const CAPTCHA_TTL_MS = 8 * 60 * 1000;

// Arkose serves enforcement from a customer-specific domain when one is
// provisioned, and from the shared one otherwise. Both are tried in order by the
// client so a key issued for either resolves. `roblox-api.arkose.com` was in this
// list and does not resolve in DNS — every widget load burned a failed request
// before the real domain was tried. Removed.
const ENFORCEMENT_DOMAINS = ['client-api.arkoselabs.com'];

// Roblox's login public key. Fetched live from the metadata endpoint and cached;
// the constant is only a fallback for an offline box. The old hardcoded value
// (47304D34-...) was retired — every widget load with it 404'd.
const ROBLOX_LOGIN_PUBLIC_KEY = '476068BF-9607-4799-B53D-966BE98E2B81';
const CAPTCHA_METADATA_URL = 'https://apis.roblox.com/captcha/v1/metadata';
const KEY_TTL_MS = 10 * 60 * 1000;
let liveLoginKey = null;
let liveLoginKeyAt = 0;

async function fetchLiveLoginKey() {
  if (liveLoginKey && Date.now() - liveLoginKeyAt < KEY_TTL_MS) return liveLoginKey;
  try {
    const res = await fetch(CAPTCHA_METADATA_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const data = await res.json();
      const key = data?.funCaptchaPublicKeys?.ACTION_TYPE_WEB_LOGIN;
      if (key && typeof key === 'string') {
        liveLoginKey = key;
        liveLoginKeyAt = Date.now();
        return liveLoginKey;
      }
    }
  } catch { /* offline or shape change — fall back to the constant */ }
  return ROBLOX_LOGIN_PUBLIC_KEY;
}

// Roblox sanitises the key before putting it in the path, keeping dashes. The
// server does the same so the path matches byte for byte.
function keyToSlug(publicKey) {
  return String(publicKey || '').replace(/[^a-zA-Z0-9-]+/g, '');
}

class CaptchaRelay {
  constructor(options = {}) {
    this.sessions = new Map();
    this.ttlMs = options.ttlMs || CAPTCHA_TTL_MS;
  }

  stage({ challengeId, metadata, jar, csrf, credentials, username, password, ctype }) {
    const meta = metadata || {};
    const publicKey = meta.publicKey || meta.unifiedCaptchaId || ROBLOX_LOGIN_PUBLIC_KEY;
    const blob = meta.dataExchangeBlob || meta.dxBlob || '';

    const captchaId = `cap_${crypto.randomBytes(16).toString('hex')}`;

    this.sessions.set(captchaId, {
      captchaId,
      challengeId,
      unifiedCaptchaId: meta.unifiedCaptchaId || null,
      actionType: meta.actionType || 'Login',
      jar,
      csrf,
      credentials,
      username,
      password,
      ctype,
      createdAt: Date.now(),
      solving: false
    });
    this.cleanup();

    return {
      captchaId,
      widget: {
        publicKey,
        slug: keyToSlug(publicKey),
        blob,
        actionType: meta.actionType || 'Login',
        domains: ENFORCEMENT_DOMAINS.slice(),
        mode: 'inline',
        noSuppress: String(meta.fc_nosuppress || '') === '1'
      },
      expiresInMs: this.ttlMs
    };
  }

  get(captchaId) {
    this.cleanup();
    return this.sessions.get(captchaId) || null;
  }

  drop(captchaId) {
    this.sessions.delete(captchaId);
  }

  cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.createdAt > this.ttlMs) this.sessions.delete(id);
    }
  }

  pendingCount() {
    this.cleanup();
    return this.sessions.size;
  }
}

module.exports = CaptchaRelay;
module.exports.keyToSlug = keyToSlug;
module.exports.ENFORCEMENT_DOMAINS = ENFORCEMENT_DOMAINS;
module.exports.ROBLOX_LOGIN_PUBLIC_KEY = ROBLOX_LOGIN_PUBLIC_KEY;
module.exports.fetchLiveLoginKey = fetchLiveLoginKey;
