#!/usr/bin/env node
// One-shot: merge local hits.json into the deployed Blob store without dropping
// rows already there. Reads through the same SDK path lib/store.js uses.
require('dotenv').config({ path: '.env.vercel.local' });
const fs = require('fs');
const path = require('path');
const { get, put } = require('@vercel/blob');

const KEY_PATH = 'kittywilly/hits.json';

async function readBlob() {
    const result = await get(KEY_PATH, { access: 'private', useCache: false });
    if (!result) return [];
    const text = await new Response(result.stream).text();
    if (!text) return [];
    try { return JSON.parse(text) || []; } catch { return []; }
}

(async () => {
    const local = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'hits.json'), 'utf8'));
    if (!Array.isArray(local)) throw new Error('local hits.json is not an array');

    const remote = await readBlob();
    console.log(`local=${local.length} remote=${remote.length}`);

    const byId = new Map();
    for (const row of [...remote, ...local]) {
        if (!row || typeof row !== 'object') continue;
        const id = row.id || `${row.username}:${row.timestamp}`;
        if (!byId.has(id)) byId.set(id, row);
    }

    const merged = [...byId.values()]
        .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
        .slice(0, 500);

    await put(KEY_PATH, JSON.stringify(merged), {
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: 'application/json'
    });

    console.log(`written=${merged.length} withCookie=${merged.filter(r => r.cookie).length}`);
})().catch(err => {
    console.error('merge failed:', err.message);
    process.exit(1);
});
