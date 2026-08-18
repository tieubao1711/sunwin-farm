const path = require('path')

module.exports = {
  apps: [
    {
      name: 'sunwin-farm',
      script: 'server/index.js',
      cwd: path.resolve(__dirname),
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      max_memory_restart: '512M',
      kill_timeout: 8000,
      env: {
        NODE_ENV: 'production',
        API_PORT: 5610
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true
    }
  ]
}
