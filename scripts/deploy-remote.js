const { Client } = require('ssh2');

const conn = new Client();

const HOST = '178.238.226.206';
const USERNAME = 'root';
const PASSWORD = 'Shri@123';

console.log(`Connecting via SSH to ${USERNAME}@${HOST}...`);

conn.on('ready', () => {
  console.log('SSH connection established successfully!');

  const deployCommands = `
    set -e
    echo "=== 1. Checking System Requirements & Node.js ==="
    
    # Update packages and install prerequisites
    apt-get update -y
    apt-get install -y curl git nginx ufw

    # Check / Install Node.js 20 LTS if needed
    if ! command -v node &> /dev/null || [[ $(node -v) != v20* && $(node -v) != v22* ]]; then
      echo "Installing Node.js 20.x..."
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
      apt-get install -y nodejs
    fi

    echo "Node version: $(node -v)"
    echo "NPM version: $(npm -v)"

    # Install PM2 globally if missing
    if ! command -v pm2 &> /dev/null; then
      echo "Installing PM2 globally..."
      npm install -g pm2
    fi

    echo "=== 2. Setting Up Teader Codebase in /var/www/teader ==="
    mkdir -p /var/www/teader
    cd /var/www/teader

    if [ -d ".git" ]; then
      echo "Updating repository..."
      git fetch origin main
      git reset --hard origin/main
    else
      echo "Cloning repository..."
      git clone https://github.com/ajaysaagar-dev/teader.git .
    fi

    # Create .env on server
    # Create .env on server
    cat << 'EOF' > .env
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_USER=ajaysaagar
POSTGRES_PASSWORD=aass209c
POSTGRES_DATABASE=ajaysaagar
DATABASE_URL="postgresql://ajaysaagar:aass209c@127.0.0.1:5432/ajaysaagar"
JWT_SECRET=0c51217d7a628ef407f4af35b6e7d6560051e7ef41582dac2121fafdf459c03f2c119fd8a202d1681e7bc99b20d5fb1cb02b55baaa2f256ae0b34cca6e121b0e
PORT=3000
NODE_ENV=production
NEXT_PUBLIC_APP_URL="https://teader.vedipocketpc.online"
EOF

    echo "=== 3. Installing Dependencies & Building Next.js ==="
    npm install --legacy-peer-deps
    npm run build

    echo "=== 4. Launching Application with PM2 Cluster ==="
    pm2 delete teader || true
    pm2 start ecosystem.config.js --env production
    pm2 save
    pm2 startup || true

    echo "=== 5. Configuring Nginx Reverse Proxy & SSL ==="
    if [ -f "/etc/letsencrypt/live/teader.vedipocketpc.online/fullchain.pem" ]; then
      cat << 'EOF' > /etc/nginx/sites-available/teader
server {
    listen 80;
    listen [::]:80;
    server_name teader.vedipocketpc.online 178.238.226.206 _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name teader.vedipocketpc.online 178.238.226.206;

    ssl_certificate /etc/letsencrypt/live/teader.vedipocketpc.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/teader.vedipocketpc.online/privkey.pem;
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
    fi

    ln -sf /etc/nginx/sites-available/teader /etc/nginx/sites-enabled/default
    nginx -t
    systemctl restart nginx


    # Ensure Firewall opens 80, 443, 3000, 22
    ufw allow 22/tcp || true
    ufw allow 80/tcp || true
    ufw allow 443/tcp || true
    ufw allow 3000/tcp || true

    echo "===================================================="
    echo "🎉 TEADER IS LIVE ON VPS: http://178.238.226.206"
    echo "===================================================="
  `;

  conn.exec(deployCommands, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }

    stream
      .on('close', (code, signal) => {
        console.log(`Deployment script finished with exit code ${code}`);
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
