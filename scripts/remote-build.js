const { Client } = require('ssh2');

const conn = new Client();
const HOST = '178.238.226.206';
const USERNAME = 'root';
const PASSWORD = 'Shri@123';

console.log(`Connecting to ${USERNAME}@${HOST}...`);

conn.on('ready', () => {
  console.log('Connected! Running build on VPS...');

  const cmd = `
    cd /var/www/teader
    git fetch origin main
    git reset --hard origin/main
    npm install --legacy-peer-deps
    npm run build
    pm2 reload all || pm2 start ecosystem.config.js --env production
    pm2 save
    echo "=== BUILD AND PM2 RELOAD COMPLETE ==="
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Error:', err);
      conn.end();
      return;
    }

    stream.on('close', (code) => {
      console.log(`Command closed with code ${code}`);
      conn.end();
    });

    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
  });
});

conn.connect({
  host: HOST,
  port: 22,
  username: USERNAME,
  password: PASSWORD,
});
