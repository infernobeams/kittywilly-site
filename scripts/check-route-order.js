#!/usr/bin/env node
// scripts/check-route-order.js
// The auth model in server.js is registration order: everything mounted under
// /api before `app.use('/api', apiGuard)` is unauthenticated by construction.
// That is fine when it is deliberate and a hole when a route is added by
// accident. This fails the check when an /api route appears above the gate
// without being on the known-public list.

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'server.js');
const GATE = "app.use('/api', apiGuard)";

// Registered above the gate on purpose. Keep this list short and justified.
const ALLOWED_ABOVE_GATE = new Set([
    "app.get('/api/user'",
    "app.post('/api/op/unlock'"
]);

const source = fs.readFileSync(FILE, 'utf8').split('\n');
const gateLine = source.findIndex(line => line.includes(GATE));
if (gateLine === -1) {
    console.error(`[check] ${GATE} not found in server.js — the gate moved or was removed.`);
    process.exit(1);
}

const ROUTE_RE = /^\s*app\.(get|post|put|patch|delete|all)\(\s*\[?\s*['"`]\/api/;
const problems = [];

source.forEach((line, index) => {
    if (index >= gateLine) return;
    if (!ROUTE_RE.test(line)) return;
    const trimmed = line.trim();
    const allowed = [...ALLOWED_ABOVE_GATE].some(prefix => trimmed.startsWith(prefix));
    if (!allowed) problems.push({ line: index + 1, text: trimmed.slice(0, 120) });
});

if (problems.length) {
    console.error('[check] /api route(s) registered above the auth gate:');
    for (const p of problems) console.error(`  server.js:${p.line}  ${p.text}`);
    console.error('[check] Move them below the gate, or add them to ALLOWED_ABOVE_GATE with a reason.');
    process.exit(1);
}

console.log(`[check] route order ok (${gateLine + 1} gate, ${source.length} lines)`);
