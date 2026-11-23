// language: JavaScript, file: scratch/vps_upload.js
// usage: node scratch/vps_upload.js <local-path> <remote-path>
const { Client } = require('ssh2');
const fs = require('fs');
const [local, remote] = process.argv.slice(2);
if (!local || !remote) { console.error('usage: node vps_upload.js <local> <remote>'); process.exit(1); }
const conn = new Client();
conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) { console.error(err); process.exit(1); }
        const rs = fs.createReadStream(local);
        const ws = sftp.createWriteStream(remote);
        rs.pipe(ws);
        ws.on('close', () => { console.log(`uploaded ${local} -> ${remote}`); conn.end(); process.exit(0); });
        ws.on('error', (e) => { console.error(e.message); conn.end(); process.exit(1); });
    });
}).on('keyboard-interactive', (n, i, l, p, f) => f(['6>qr[BT0un[!)Y$=']))
  .connect({ host: '162.246.21.99', port: 22, username: 'injew', password: '6>qr[BT0un[!)Y$=', tryKeyboard: true });
