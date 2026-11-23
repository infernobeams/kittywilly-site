// language: JavaScript, file: scratch/beamse/build_css.js
// Concatenates the design stylesheet + beamse additions into scratch/beamse/dashboard.css
const fs = require('fs');
const path = require('path');
const base_path = path.join(__dirname, '..', '..', 'public', 'style.css');
const add_path = path.join(__dirname, 'additions.css');
const out_path = path.join(__dirname, 'dashboard.css');
const base = fs.readFileSync(base_path, 'utf8');
const add = fs.readFileSync(add_path, 'utf8');
fs.writeFileSync(out_path, base + '\n\n/* ═══ additions appended by build_css.js ═══ */\n\n' + add);
console.log('written', out_path, 'bytes:', (base.length + add.length), 'base:', base.length, 'add:', add.length);
