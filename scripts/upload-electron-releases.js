const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');

const HOST = '178.238.226.206';
const USERNAME = 'root';
const PASSWORD = 'Shri@123';

const conn = new Client();

const localDistDir = path.resolve(__dirname, '..', '..', 'teader-electron', 'dist');
const remoteReleasesDir = '/var/www/releases';
const remoteNextPublicReleasesDir = '/var/www/teader/public/releases';

const filesToUpload = [
  { name: 'latest.yml', localPath: path.resolve(__dirname, '..', '..', 'teader-electron', 'build-dist', 'nsis-web', 'latest.yml') },
  { name: 'teader-electron-0.0.1-x64.nsis.7z', localPath: path.resolve(__dirname, '..', '..', 'teader-electron', 'build-dist', 'nsis-web', 'teader-electron-0.0.1-x64.nsis.7z') },
  { name: 'Teader-Workspace-Web-Setup.exe', localPath: path.resolve(__dirname, '..', '..', 'teader-electron', 'build-dist', 'nsis-web', 'Teader Workspace Web Setup 0.0.1.exe') },
  { name: 'Teader-Workspace-Setup.exe', localPath: path.resolve(__dirname, '..', '..', 'teader-electron', 'build-dist', 'Teader Workspace Setup 0.0.1.exe') },
];

console.log(`Connecting to VPS ${USERNAME}@${HOST}...`);

conn.on('ready', () => {
  console.log('✅ SSH connection established!');

  // First ensure directories exist and Nginx config includes /releases/ location
  const prepareCommands = `
    mkdir -p ${remoteReleasesDir}
    mkdir -p ${remoteNextPublicReleasesDir}

    # Ensure Nginx config serves /releases directly
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

    client_max_body_size 200M;

    location /releases/ {
        alias /var/www/releases/;
        autoindex on;
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "no-cache";
    }

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
    nginx -t && systemctl reload nginx
    echo "Nginx reloaded successfully with /releases/ endpoint!"
  `;

  conn.exec(prepareCommands, (err, stream) => {
    if (err) {
      console.error('Failed to run prepare commands:', err);
      conn.end();
      return;
    }

    stream.on('close', (code) => {
      if (code !== 0) {
        console.error(`Prepare commands exited with code ${code}`);
        conn.end();
        return;
      }

      console.log('🚀 Starting SFTP file uploads...');

      conn.sftp((sftpErr, sftp) => {
        if (sftpErr) {
          console.error('SFTP initialization failed:', sftpErr);
          conn.end();
          return;
        }

        let uploadIndex = 0;

        function uploadNext() {
          if (uploadIndex >= filesToUpload.length) {
            console.log('\n🎉 ALL RELEASES SUCCESSFULLY UPLOADED TO VPS!');
            sftp.end();
            conn.end();
            return;
          }

          const item = filesToUpload[uploadIndex];
          const fileName = item.name;
          const localPath = item.localPath;
          const remotePath = `${remoteReleasesDir}/${fileName}`;

          if (!fs.existsSync(localPath)) {
            console.warn(`⚠️ Local file not found: ${localPath}, skipping.`);
            uploadIndex++;
            uploadNext();
            return;
          }

          const stats = fs.statSync(localPath);
          const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
          console.log(`📤 Uploading [${uploadIndex + 1}/${filesToUpload.length}] ${fileName} (${sizeMB} MB)...`);

          let lastLoggedPercent = 0;

          sftp.fastPut(
            localPath,
            remotePath,
            {
              step: (transferred, _chunk, total) => {
                const percent = Math.round((transferred / total) * 100);
                if (percent >= lastLoggedPercent + 20 || percent === 100) {
                  lastLoggedPercent = percent;
                  process.stdout.write(`   ↳ ${percent}% (${(transferred / (1024 * 1024)).toFixed(1)} / ${sizeMB} MB)\n`);
                }
              },
            },
            (putErr) => {
              if (putErr) {
                console.error(`❌ Error uploading ${fileName}:`, putErr);
              } else {
                console.log(`✅ Uploaded ${fileName}`);
              }
              uploadIndex++;
              uploadNext();
            }
          );
        }

        uploadNext();
      });
    });

    stream.on('data', (data) => process.stdout.write(data.toString()));
    stream.stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
});

conn.on('error', (err) => {
  console.error('SSH Connection Error:', err);
});

conn.connect({
  host: HOST,
  port: 22,
  username: USERNAME,
  password: PASSWORD,
  readyTimeout: 30000,
});
