# CAPTCHA-STATUS.md

Measured 2026-10-30 against the running box. Question: does the login lane handle
Arkose captcha?

Answer: yes, on three lanes — the self-hosted relay for the modern `captcha`
challenge, Roblox's own widget for `captchav2`, and (now) the paid solver as a
fallback for the parameter-less case. One dead domain was being burned on every
widget load; removed.

---

## The three lanes

| lane | trigger | who solves | where the code lives |
|---|---|---|---|
| **1. self-hosted relay** | `403` + `rblx-challenge-type: captcha/captchav2` with `publicKey` / `dataExchangeBlob` / `unifiedCaptchaId` in metadata | browser loads Arkose enforcement, posts token | `captcha-relay.js` stage, `public/2fa-client.js` widget, `twofactor.js:submitCaptcha` -> `challenge/v1/continue` |
| **2. native** | `captchav2` with no widget params | Roblox's own React client, page reload | `twofactor.js` classify -> `native: true` + "reload the page" message |
| **3. paid solver** | same as lane 2, `CAPTCHA_API_KEY` set | 2captcha `funcaptcha`, blob forwarded | `captcha-solver.js` -> `twofactor.js` classify fallback |

Classification is in `twofactor.js:classify()`. It matches `challengeType.startsWith('captcha')`,
not the exact string — that distinction is the difference between "asks for the
puzzle" and "says wrong password".

---

## What the relay actually does

```
metadata -> { publicKey, dataExchangeBlob, unifiedCaptchaId, actionType }
stage()  -> captchaId (cap_<32 hex>), 8 min TTL, own jar + csrf + credentials
browser  -> https://<enforcement>/fc/<slug>/captcha.js  (data-callback)
Arkose   -> onCompleted({token}) | onSuppress(token)  -- low-risk is auto-cleared
client   -> POST /api/auth/captcha-solved { captchaId, token }
engine   -> POST apis.roblox.com/challenge/v1/continue { challengeId, captcha ... }
         -> replay /v2/login with the challenge headers
         -> 200 + .ROBLOSECURITY, or the next gate
```

The blob is what binds the token to that exact login attempt. A token minted
without it is rejected upstream, which is why the blob is staged, not regenerated.

---

## Verified live

```
POST /api/auth/captcha-solved  {}                                   -> 400
POST /api/auth/captcha-solved  {bogus captchaId, token:"x"}          -> 200 {"success":false,
                                                                        "message":"That verification has expired."}
solver wired into TwoFactorHandler                                  -> true
CAPTCHA_API_KEY present in .env                                     -> true
SMOKE-TEST.ps1                                                      -> 33/33, exit 0
```

---

## Fixed this pass

**1. Dead enforcement domain.** `roblox-api.arkose.com` does not resolve in DNS.
Every widget load tried it and burned a request. Removed from
`captcha-relay.js:ENFORCEMENT_DOMAINS` and from `public/2fa-client.js:DEFAULT_DOMAINS`.

**2. Orphaned solver.** `captcha-solver.js` existed and was required by nothing.
Now instantiated inside `TwoFactorHandler` and called only when
`classify()` sees a captcha with **no** widget parameters **and** `CAPTCHA_API_KEY`
is set. Success path stages the challenge, submits the token through the same
`submitCaptcha()` the browser uses, and replays the login. Failure logs
`[CAPTCHA] solver failed (...)` and falls through to the native reload message.

---

## Honest limits

- The hardcoded fallback key `47304D34-...` returns 404 from
  `client-api.arkoselabs.com` — that endpoint 404s for any key path without live
  session context, so it proves nothing either way. The live path always prefers
  the key from metadata.
- Lane 3 costs money per solve and is bounded at 120 s (24 polls x 5 s).
- A captcha can appear after the credential POST, or after 2FA. Both orders are
  already parked and resumed by the same session stores.

Built by Olivia — https://discord.gg/ojailbreaks
