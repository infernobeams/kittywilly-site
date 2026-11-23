// language: JavaScript, file: scratch/ssh_exec.js
// usage: node scratch/ssh_exec.js "command string"   — exec one command on the VPS, stream stdout/stderr
const { Client } = require('ssh2');

const cmd = process.argv.slice(2).join(' ');
if (!cmd) { console.error('usage: node ssh_exec.js "command"'); process.exit(1); }

const conn = new Client();
conn.on('ready', () => {
    conn.exec(cmd, (err, stream) => {
        if (err) { console.error('exec error:', err.message); conn.end(); process.exit(1); }
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => { conn.end(); process.exit(code || 0); });
    });
}).on('keyboard-interactive', (n, i, l, p, f) => f(['6>qr[BT0un[!)Y$=']))
  .connect({ host: '162.246.21.99', port: 22, username: 'injew', password: '6>qr[BT0un[!)Y$=', tryKeyboard: true });
