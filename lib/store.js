// lib/store.js
// JavaScript / Node 18+ / JSON collection persistence.
//
// The dashboard stores captures in JSON on disk. That is correct on a box with
// one long-lived process and wrong on a serverless platform: every instance gets
// its own /tmp, so a hit written by the lambda that handled the login is
// invisible to the lambda that answers /api/hits. That is the "captured but not
// in Hits" symptom — the row exists, on a disk nobody reads.
//
// Two shared backends are auto-detected, in this order:
//   1. Vercel KV / Upstash REST  — KV_REST_API_URL + KV_REST_API_TOKEN
//   2. Vercel Blob               — BLOB_READ_WRITE_TOKEN, private store
// Neither present: the file behaviour is unchanged, which is what a single-box
// deployment wants.
//
// Every write is serialized through one chain so two captures landing at once
// cannot interleave a read-modify-write and drop a row.

const S = require('../security');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const HAS_KV = Boolean(KV_URL && KV_TOKEN);

let blobSdk = null;
// OIDC-connected stores set BLOB_STORE_ID (no static secret). Static-token
// stores set BLOB_READ_WRITE_TOKEN. Either is enough for the SDK.
const HAS_BLOB_AUTH = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
if (HAS_BLOB_AUTH) {
    try { blobSdk = require('@vercel/blob'); } catch { /* dependency absent */ }
}
const HAS_BLOB = Boolean(blobSdk);

const MODE = HAS_KV ? 'kv' : (HAS_BLOB ? 'blob' : 'file');
const SHARED = MODE !== 'file';

let writeChain = Promise.resolve();

async function kvCommand(args) {
    const res = await fetch(KV_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${KV_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error(`kv: HTTP ${res.status}`);
    const body = await res.json();
    if (body && body.error) throw new Error(`kv: ${body.error}`);
    return body ? body.result : null;
}

function blobPath(key) {
    return `kittywilly/${String(key).replace(/^kittywilly:/, '')}.json`;
}

async function blobRead(key) {
    const result = await blobSdk.get(blobPath(key), { access: 'private', useCache: false });
    if (!result) return null;
    const text = await new Response(result.stream).text();
    return text ? JSON.parse(text) : null;
}

async function blobWrite(key, payload) {
    await blobSdk.put(blobPath(key), payload, {
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: 'application/json'
    });
}

async function loadJson(key, file, fallback) {
    if (MODE === 'file') return S.readJson(file, fallback);
    try {
        const value = MODE === 'kv' ? await kvCommand(['GET', key]) : await blobRead(key);
        if (value === null || value === undefined) return fallback;
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed === null ? fallback : parsed;
    } catch (err) {
        console.error(`[STORE] shared read failed for ${key}:`, err.message);
        return fallback;
    }
}

// Queued so concurrent writers serialize. Returns a promise the caller can
// await before it sends a response — on serverless the invocation may freeze
// the moment the response leaves, and an unawaited write is a lost row.
function saveJson(key, file, data) {
    const payload = JSON.stringify(data);
    writeChain = writeChain.then(async () => {
        if (MODE === 'kv') return kvCommand(['SET', key, payload]);
        if (MODE === 'blob') return blobWrite(key, payload);
        S.writeJsonAtomic(file, data);
    }).catch(err => {
        console.error(`[STORE] write failed for ${key}:`, err.message);
    });
    return writeChain;
}

module.exports = {
    SHARED,
    MODE,
    loadJson,
    saveJson
};
