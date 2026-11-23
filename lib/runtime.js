// Vercel functions get a read-only project directory. Anything the app writes
// (sessions, captures, caches) has to live under /tmp instead. Locally the
// project directory stays the data directory so existing files keep working.
const fs = require('fs');
const path = require('path');

const IS_VERCEL = Boolean(process.env.VERCEL);
const ROOT = path.join(__dirname, '..');
const DATA_DIR = IS_VERCEL ? '/tmp/kittywilly' : ROOT;

function ensureDir(dir) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* read-only or exists */ }
}

ensureDir(DATA_DIR);

function dataPath(...parts) {
    const target = path.join(DATA_DIR, ...parts);
    ensureDir(path.dirname(target));
    return target;
}

// First write to a file that ships with the app: copy the bundled copy into
// the writable directory so reads and writes agree on one path.
function seededDataPath(...parts) {
    const target = dataPath(...parts);
    const source = path.join(ROOT, ...parts);
    try {
        if (!fs.existsSync(target) && fs.existsSync(source)) {
            fs.copyFileSync(source, target);
        }
    } catch { /* best effort seed */ }
    return target;
}

// Same idea for directories (templates, generated sites).
function seededDirPath(...parts) {
    const target = dataPath(...parts);
    const source = path.join(ROOT, ...parts);
    try {
        if (!fs.existsSync(target) && fs.existsSync(source)) {
            fs.cpSync(source, target, { recursive: true });
        }
    } catch { /* best effort seed */ }
    ensureDir(target);
    return target;
}

module.exports = { IS_VERCEL, ROOT, DATA_DIR, dataPath, seededDataPath, seededDirPath, ensureDir };
