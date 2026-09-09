module.exports = {
  apps: [{
    name: 'tokotrijaya',
    script: 'server.js',
    instances: 1,               // 1 instance untuk SQLite (1 writer)
    exec_mode: 'fork',          // Fork mode untuk SQLite
    autorestart: true,          // Auto restart jika crash
    watch: false,               // Jangan watch di production
    max_memory_restart: '256M', // Restart kalau memory > 256MB
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    },
    // Log files
    error_file: '/tmp/tokotrijaya-error.log',
    out_file: '/tmp/tokotrijaya-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
