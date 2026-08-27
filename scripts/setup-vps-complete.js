const { Client } = require('ssh2');

const conn = new Client();

const HOST = '178.238.226.206';
const USERNAME = 'root';
const PASSWORD = 'Shri@123';

console.log(`Connecting via SSH to ${USERNAME}@${HOST}...`);

conn.on('ready', () => {
  console.log('SSH connection established successfully!');

  const script = `
    set -e
    echo "=========================================================="
    echo "1. Installing & Configuring PostgreSQL Database on VPS"
    echo "=========================================================="
    
    # Install PostgreSQL & Contrib
    apt-get update -y
    apt-get install -y postgresql postgresql-contrib

    # Start and enable PostgreSQL service
    systemctl start postgresql
    systemctl enable postgresql

    # Create PostgreSQL user and database safely
    sudo -u postgres psql -c "CREATE USER ajaysaagar WITH PASSWORD 'aass209c' SUPERUSER CREATEDB REPLICATION;" 2>/dev/null || sudo -u postgres psql -c "ALTER USER ajaysaagar WITH PASSWORD 'aass209c' SUPERUSER CREATEDB REPLICATION;"
    
    sudo -u postgres psql -c "CREATE DATABASE ajaysaagar OWNER ajaysaagar;" 2>/dev/null || true

    # Grant all privileges
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ajaysaagar TO ajaysaagar;"
    sudo -u postgres psql -d ajaysaagar -c "GRANT ALL ON SCHEMA public TO ajaysaagar;"


    echo "✅ PostgreSQL user and database 'ajaysaagar' configured successfully!"

    echo "=========================================================="
    echo "2. Updating Teader Codebase from Repository"
    echo "=========================================================="
    mkdir -p /var/www/teader
    cd /var/www/teader

    if [ -d ".git" ]; then
      echo "Fetching latest changes from origin/main..."
      git fetch origin main
      git reset --hard origin/main
    else
      echo "Cloning repository..."
      git clone https://github.com/ajaysaagar-dev/teader.git .
    fi

    # Write production .env with local PostgreSQL connection
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
NEXT_PUBLIC_APP_URL="http://teader.vedipocketpc.online"
EOF

    echo "=========================================================="
    echo "3. Installing Dependencies & Compiling Next.js Build"
    echo "=========================================================="
    npm install --legacy-peer-deps
    npm run build

    echo "=========================================================="
    echo "4. Reloading PM2 Cluster & Nginx"
    echo "=========================================================="
    pm2 delete teader || true
    pm2 start ecosystem.config.js --env production
    pm2 save
    systemctl restart nginx

    echo "=========================================================="
    echo "5. Verifying Local PostgreSQL DB Connection"
    echo "=========================================================="
    node -e "
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: 'postgresql://ajaysaagar:aass209c@127.0.0.1:5432/ajaysaagar' });
      pool.query('SELECT NOW()', (err, res) => {
        if (err) {
          console.error('❌ PostgreSQL connection test failed:', err.message);
        } else {
          console.log('✅ PostgreSQL local connection verified successfully! Server time:', res.rows[0].now);
        }
        pool.end();
      });
    "

    echo "=========================================================="
    echo "🎉 TEADER IS UPDATED & FULLY CONNECTED TO LOCAL POSTGRESQL!"
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
        console.log(`Setup finished with exit code ${code}`);
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
