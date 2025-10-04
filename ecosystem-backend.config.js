module.exports = {
  apps: [
    {
      name: 'yugafarms-backend',
      cwd: './YugaFarmsBackend',
      script: 'npm',
      args: 'run develop',
      env: {
        NODE_ENV: 'production',
        PORT: 1337
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 1337
      }
    }
  ]
};
