// lib/capture-nonce.js
// Stateless capture nonce.
//
// /api/capture-login must stay reachable from the login page without a session,
// but it must not be a public write that any stranger can hammer. A random
// per-render nonce held in memory does not survive serverless: the lambda that
// renders the login page is not the lambda that receives the beacon. So the
// nonce is signed, not stored:
//
//   <epochMs>.<random>.<hmac-sha256(secret, "<epochMs>.<random>")>
//
// Verification recomputes the MAC and checks the age. No shared state, no
// dependence on which instance answers.

const crypto = require('crypto');

const TTL_MS = 30 * 60 * 1000;
const NONCE_RE = /^(\d{10,16})\.([a-f0-9]{16,64})\.([a-f0-9]{64})$/;

function secret() {
    return String(process.env.SESSION_SECRET || '');
}

function sign(payload) {
    return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

function issue() {
    const ts = String(Date.now());
    const rand = crypto.randomBytes(16).toString('hex');
    const payload = `${ts}.${rand}`;
    return `${payload}.${sign(payload)}`;
}

function verify(value) {
    if (!value || typeof value !== 'string') return false;
    const match = NONCE_RE.exec(value.trim());
    if (!match) return false;
    const [, ts, rand, mac] = match;
    const payload = `${ts}.${rand}`;
    const expected = sign(payload);
    const a = Buffer.from(mac, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const issuedAt = Number(ts);
    if (!Number.isFinite(issuedAt)) return false;
    return Date.now() - issuedAt <= TTL_MS;
}

module.exports = { issue, verify, NONCE_RE, TTL_MS };
