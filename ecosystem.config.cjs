module.exports = {
  apps: [
    {
      name: "trading-bot",
      script: "node",
      args: "dist/index.cjs",
      // Ajusta para o caminho real do projeto na VPS
      cwd: "/root/trading-bot",
      // Secrets não vivem aqui — vêm do ambiente (.env na VPS, ver README)
      env: {
        NODE_ENV: "production",
        PORT: "5000",
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
    },
  ],
};
