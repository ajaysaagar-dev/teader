const { Client } = require('ssh2');

const conn = new Client();

const HOST = '178.238.226.206';
const USERNAME = 'root';
const PASSWORD = 'Shri@123';
const DOMAIN = 'teader.vedipocketpc.online';

console.log('Fixing Nginx SSL configuration for ' + DOMAIN + '...');

conn.on('ready', () => {
  const script = `
    set -e

    cat << 'EOF' > /etc/nginx/sites-available/teader
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} 178.238.226.206 _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} 178.238.226.206;

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/teader /etc/nginx/sites-enabled/default
    nginx -t
    systemctl restart nginx
    echo "Nginx successfully configured with dedicated SSL for ${DOMAIN}!"
  `;

  conn.exec(script, (err, stream) => {
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
      .on('data', (d) => process.stdout.write(d.toString()))
      .stderr.on('data', (d) => process.stderr.write(d.toString()));
  });
});

conn.connect({
  host: HOST,
  port: 22,
  username: USERNAME,
  password: PASSWORD,
  readyTimeout: 30000,
});
