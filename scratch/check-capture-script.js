const fs = require('fs');
const src = fs.readFileSync('lib/pages/login.js', 'utf8');
const startMark = 'const CAPTURE_SCRIPT = ';
const a = src.indexOf(startMark);
if (a < 0) { console.log('no CAPTURE_SCRIPT'); process.exit(1); }
const openTick = src.indexOf('`', a);
const closeTick = src.indexOf('`;', openTick + 1);
if (openTick < 0 || closeTick < 0) { console.log('template markers missing'); process.exit(1); }
let js = src.slice(openTick + 1, closeTick);
js = js.replace(/^<script>/, '').replace(/<\/script>\s*$/, '');
js = js.split('__CAPTURE_NONCE__').join('n0nce');
try {
    new Function(js);
    console.log('capture script parses, bytes', js.length, 'lines', js.split('\n').length);
} catch (e) {
    console.log('PARSE FAIL:', e.message);
    process.exit(1);
}
