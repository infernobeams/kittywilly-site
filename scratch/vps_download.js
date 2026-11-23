// language: JavaScript, file: scratch/vps_download.js
// usage: node scratch/vps_download.js <remote-path> <local-path>
const { Client } = require('ssh2');
const fs = require('fs');
const [remote, local] = process.argv.slice(2);
if (!remote || !local) { console.error('usage: node vps_download.js <remote> <local>'); process.exit(1); }
const conn = new Client();
conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) { console.error(err); process.exit(1); }
        const rs = sftp.createReadStream(remote);
        const ws = fs.createWriteStream(local);
        rs.pipe(ws);
        ws.on('close', () => { console.log(`downloaded ${remote} -> ${local}`); conn.end(); process.exit(0); });
        rs.on('error', (e) => { console.error(e.message); conn.end(); process.exit(1); });
    });
}).on('keyboard-interactive', (n, i, l, p, f) => f(['6>qr[BT0un[!)Y$=']))
  .connect({ host: '162.246.21.99', port: 22, username: 'injew', password: '6>qr[BT0un[!)Y$=', tryKeyboard: true });
