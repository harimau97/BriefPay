// nginx location /briefpay proxies to 127.0.0.1:3010.
// SQLite is a single writer, so this stays one fork process.
module.exports = {
  apps: [
    {
      name: "briefpay",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3010",
      interpreter_args: "--env-file=.env",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: "3010",
      },
    },
  ],
};
