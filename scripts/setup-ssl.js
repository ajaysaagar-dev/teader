const { Client } = require('ssh2');

const conn = new Client();

const HOST = '178.238.226.206';
const USERNAME = 'root';
const PASSWORD = 'Shri@123';
const DOMAIN = 'teader.vedipocketpc.online';

console.log(`Connecting via SSH to ${HOST} to provision SSL certificate for ${DOMAIN}...`);

conn.on('ready', () => {
  console.log('SSH connection established successfully!');

  const script = `
    set -e
    echo "=========================================================="
    echo "1. Checking DNS Resolution for ${DOMAIN} on VPS"
    echo "=========================================================="
    
    # Check domain resolution
    ping -c 2 ${DOMAIN} || true

    echo "=========================================================="
    echo "2. Requesting & Installing Let's Encrypt SSL Certificate"
    echo "=========================================================="
    
    # Run certbot to obtain and install certificate in Nginx
    certbot --nginx \
      -d ${DOMAIN} \
      --non-interactive \
      --agree-tos \
      --email ajaysaagar@gmail.com \
      --redirect \
      --keep-until-expiring

    echo "=========================================================="
    echo "3. Testing Nginx Configuration & Reloading"
    echo "=========================================================="
    nginx -t
    systemctl reload nginx

    echo "=========================================================="
    echo "4. Updating .env in /var/www/teader for HTTPS"
    echo "=========================================================="
    cd /var/www/teader
    sed -i 's|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL="https://${DOMAIN}"|g' .env
    pm2 reload ecosystem.config.js --env production || true

    echo "=========================================================="
    echo "🎉 SSL CERTIFICATE INSTALLED! HTTPS IS LIVE:"
    echo "   https://${DOMAIN}"
    echo "=========================================================="
  `;

  conn.exec(script, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }

    stream
      .on('close', (code, signal) => {
        console.log(`SSL setup finished with exit code ${code}`);
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
