const { Client } = require('ssh2');

const conn = new Client();

const HOST = '178.238.226.206';
const USERNAME = 'root';
const PASSWORD = 'Shri@123';

console.log('Switching VPS codebase to track production branch...');

conn.on('ready', () => {
  const cmd = `
    cd /var/www/teader
    git fetch origin production
    git checkout -B production origin/production
    git reset --hard origin/production
    echo "VPS is now tracking branch: $(git branch --show-current)"
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream
      .on('close', (code) => {
        console.log('Finished with code:', code);
        conn.end();
      })
      .on('data', (d) => process.stdout.write(d.toString()));
  });
});

conn.connect({
  host: HOST,
  port: 22,
  username: USERNAME,
  password: PASSWORD,
  readyTimeout: 30000,
});
