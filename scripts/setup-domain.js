const { Client } = require('ssh2');

const conn = new Client();

const HOST = '178.238.226.206';
const USERNAME = 'root';
const PASSWORD = 'Shri@123';
const DOMAIN = 'teader.vedipocketpc.online';

console.log(`Connecting to VPS ${HOST} to configure domain ${DOMAIN}...`);

conn.on('ready', () => {
  console.log('SSH connection established successfully!');

  const commands = `
    set -e
    echo "=== 1. Updating Nginx for ${DOMAIN} ==="
    
    # Install certbot for automated Let's Encrypt SSL
    apt-get update -y
    apt-get install -y certbot python3-certbot-nginx

    # Configure Nginx virtual host with support for teader.vedipocketpc.online
    cat << 'EOF' > /etc/nginx/sites-available/teader
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} 178.238.226.206 _;

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

    echo "=== 2. Updating .env in /var/www/teader ==="
    cd /var/www/teader
    sed -i 's|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL="https://${DOMAIN}"|g' .env || echo 'NEXT_PUBLIC_APP_URL="https://${DOMAIN}"' >> .env

    # Reload PM2
    pm2 reload ecosystem.config.js --env production || pm2 restart teader

    echo "=== 3. Attempting Certbot SSL Certificate Setup ==="
    # If DNS has already propagated to 178.238.226.206, certbot will obtain HTTPS cert automatically
    certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} --redirect || echo "⚠️ DNS may still be propagating in Netlify. Once DNS is added, SSL can be finalized."

    echo "============================================================"
    echo "🎉 Nginx configured on VPS for http://${DOMAIN} & https://${DOMAIN}"
    echo "============================================================"
  `;

  conn.exec(commands, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }

    stream
      .on('close', (code, signal) => {
        console.log(`Domain setup script finished with exit code ${code}`);
        conn.end();
        process.exit(code || 0);
      })
      .on('data', (data) => {
        process.stdout.write(data.toString());
      })
      .stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });
  });
});

conn.on('error', (err) => {
  console.error('SSH Connection error:', err);
  process.exit(1);
});

conn.connect({
  host: HOST,
  port: 22,
  username: USERNAME,
  password: PASSWORD,
  readyTimeout: 30000,
});
