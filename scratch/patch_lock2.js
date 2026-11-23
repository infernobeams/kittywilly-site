const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'public', '2fa-client.js');
const b64 = fs.readFileSync(path.join(__dirname, 'rbx-lock-full.b64.txt'), 'utf8').trim();

let src = fs.readFileSync(target, 'utf8');

const start = src.indexOf("var LOCK_SVG = 'data:image/svg+xml;base64,");
if (start === -1) {
    console.error('LOCK_SVG not found');
    process.exit(1);
}
const end = src.indexOf("';", start);
if (end === -1) {
    console.error('terminator not found');
    process.exit(1);
}

src = src.slice(0, start) + "var LOCK_SVG = 'data:image/svg+xml;base64," + b64 + src.slice(end);

// The full plate already carries the lock; give it room to read at 72px.
src = src.replace(
    "'.rbx2fa-lock{width:64px;height:64px;margin:0 auto 14px;display:block;background-repeat:no-repeat;',",
    "'.rbx2fa-lock{width:72px;height:72px;margin:0 auto 14px;display:block;background-repeat:no-repeat;',"
).replace(
    "'background-position:center;background-size:64px 64px}',",
    "'background-position:center;background-size:72px 72px}',"
);

fs.writeFileSync(target, src);
console.log('patched full lock, b64 len', b64.length);
