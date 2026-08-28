module.exports = {
  apps: [
    {
      name: 'teader',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: './',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'teader-ws',
      script: 'server/ws-server.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        WS_PORT: 3001,
        WS_HOST: '0.0.0.0',
      },
      env_production: {
        NODE_ENV: 'production',
        WS_PORT: 3001,
        WS_HOST: '0.0.0.0',
      },
    },
  ],
};
