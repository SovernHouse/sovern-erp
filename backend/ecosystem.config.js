module.exports = {
  apps: [{
    name: 'sovern-erp',
    script: 'server.js',
    cwd: '/home/alex/sovern-erp/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '700M',
    env: {
      NODE_ENV: 'production',
      // L-061: production SQLite storage location. Moved out of .env so
      // test/dev code paths that load dotenv do NOT inherit this and
      // accidentally point sync({force:true}) at prod. Set here in PM2
      // env so only the production server process gets it.
      SQLITE_STORAGE: '/home/alex/sovern-erp/data/erp.db'
    },
    error_file: '/home/alex/sovern-erp/logs/err.log',
    out_file: '/home/alex/sovern-erp/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};
