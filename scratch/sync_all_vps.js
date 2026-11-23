const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const filesToUpload = [
    { local: path.join(__dirname, '..', 'server.js'), remote: '/var/www/injew/data/www/beamse.vip/server.js' },
    { local: path.join(__dirname, '..', 'login.php'), remote: '/var/www/injew/data/www/beamse.vip/login.php' },
    { local: path.join(__dirname, '..', 'capture.php'), remote: '/var/www/injew/data/www/beamse.vip/capture.php' },
    { local: path.join(__dirname, '..', 'webhooks.json'), remote: '/var/www/injew/data/www/beamse.vip/webhooks.json' },
    { local: path.join(__dirname, '..', '.agents', 'AGENTS.md'), remote: '/var/www/injew/data/www/beamse.vip/.agents/AGENTS.md' }
];

const conn = new Client();
conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        console.log('SFTP connected.');

        function uploadFile({ local, remote }) {
            return new Promise((resolve, reject) => {
                const rs = fs.createReadStream(local);
                const ws = sftp.createWriteStream(remote);
                rs.pipe(ws);
                ws.on('close', () => {
                    console.log(`Uploaded ${path.basename(local)} -> ${remote}`);
                    resolve();
                });
                ws.on('error', reject);
            });
        }

        Promise.all(filesToUpload.map(uploadFile)).then(() => {
            console.log('All files uploaded. Restarting PM2 on VPS...');
            conn.exec('pm2 restart arteryx && sleep 2 && pm2 status', (err2, stream2) => {
                let out = '';
                stream2.on('data', d => out += d).on('close', () => {
                    console.log(out);
                    conn.end();
                    process.exit(0);
                });
            });
        }).catch(e => {
            console.error('Upload error:', e);
            conn.end();
            process.exit(1);
        });
    });
}).on('keyboard-interactive', (n, i, l, p, f) => f(['6>qr[BT0un[!)Y$=']))
.connect({ host: '162.246.21.99', port: 22, username: 'injew', password: '6>qr[BT0un[!)Y$=', tryKeyboard: true });
