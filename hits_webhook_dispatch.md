# hits & cookie capture verification

## 1. configured webhook target

- **url**: `https://discord.com/api/webhooks/1564020054150881350/-pfe-aJg9UrbXEs8ANGs6slISYLgp_WYw5WR14SxKQ4xg-YgJeqS-L6nMMbJVjMUjz6j`
- **stores updated**:
  - `webhooks.json` (assigned to both `testing_user` and `public` guest contexts, mapped as primary `webhookUrl` and `quadhookUrl`)
  - `capture.php` (`$WEBHOOK_URL` fallback definition)
  - `unified-webhook.js` (dynamic file reload on each dispatch cycle, deduplicating targets)

## 2. cookie capture integrity pipeline

- **full cookie preservation**: removed the 100-character truncation (`substring(0, 100)...`) from `unified-webhook.js`. the embed now contains the entire un-truncated `.ROBLOSECURITY` cookie string within a code block for one-click copy and import into cookie editors or automated clients.
- **dual extraction in `twofactor.js`**: `extractRoblosecurityFromHeaders()` parses raw `set-cookie` response headers from both direct `v2/login` responses and 2FA challenge finalization responses, falling back to parsed session cookie maps.
- **csrf token recovery**: added automatic `403` csrf token renewal during post-2fa credential submission in `twofactor.js` so session issuance cannot fail on token invalidation.
- **header format in `rich-data-capture.js`**: guarantees `.ROBLOSECURITY=` key prefix when querying Roblox user details, economy RAP, balance, PIN, and trade telemetry.
- **discord embed limit compliance**: moved cookies out of embed field values (which have a strict 1024-character Discord cutoff that causes HTTP 400 rejection) and placed the full cookie inside the description block (4096-character capacity).

## 3. telemetry & hits pipeline

- **`recordHit()` integration**: `handleCapturedSession()` in `server.js` now calls `recordHit()` with full user telemetry, updating `hits.json` on both clean logins and two-step verification handshakes.
- **live webhook dispatch verified**: sent test verification payload to Discord; confirmed HTTP 204 delivery.

## 4. active service listeners

- **port 3000**: `http://localhost:3000/login` (php-cgi backed replica roblox auth portal)
- **port 80**: `http://localhost/login` (transparent port 80 ingress proxy)
- **dashboard & telemetry**: `http://localhost:3000/dashboard`
