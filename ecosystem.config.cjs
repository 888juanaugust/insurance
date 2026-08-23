/**
 * PM2 process definition. One instance: the sign-in throttle and the SQLite
 * connection are both per-process, so clustering needs those moved out first.
 */
module.exports = {
  apps: [
    {
      name: 'insurhelp',
      cwd: '/var/www/insurhelp',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      env_file: '.env.production',
      out_file: '/var/log/insurhelp/out.log',
      error_file: '/var/log/insurhelp/error.log',
      time: true,
    },
  ],
};
