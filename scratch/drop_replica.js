const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '..', 'login.php');
let src = fs.readFileSync(target, 'utf8');

const startMark = '// Loads the replica 2-step verification client.';
const start = src.indexOf(startMark);
if (start === -1) { console.error('start not found'); process.exit(1); }

// The block is a heredoc that ends at the first "HTML;\n" after the start.
const endMark = 'HTML;\n';
const end = src.indexOf(endMark, start);
if (end === -1) { console.error('end not found'); process.exit(1); }

const removed = end + endMark.length - start;
src = src.slice(0, start) + src.slice(end + endMark.length);
fs.writeFileSync(target, src);
console.log('removed', removed, 'chars');
