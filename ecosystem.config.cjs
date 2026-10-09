// pm2 process file for production (/home/ubuntu/boxdiamonds-project).
// Start or apply changes with:
//   pm2 delete boxdiamonds-backend boxdiamonds-web; pm2 start ecosystem.config.cjs; pm2 save
//
// Cluster mode runs several copies of each server so every CPU core is used
// (size BACKEND_INSTANCES / WEB_INSTANCES to the machine: 3 + 3 on 4 vCPUs —
// page rendering is the CPU-heavy part; the backend copies sit mostly idle).
// Safe to cluster: sessions, carts and OTPs live in Postgres and pg-boss runs
// each scheduled job once across all copies. A copy that grows past its
// memory cap is restarted on its own, without dropping the others.
const fs = require('node:fs');
const path = require('node:path');

// The web server needs DATABASE_URL (page cache) — read it from the
// backend's .env so the secret is kept in one place, not in this file.
function readEnv(file, key) {
  try {
    const line = fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : undefined;
  } catch {
    return undefined;
  }
}

// PM2_EXEC_MODE=fork (with *_INSTANCES=1) is the fallback to the old
// one-process setup if cluster mode ever misbehaves.
const execMode = process.env.PM2_EXEC_MODE ?? 'cluster';

const backendEnvFile = path.join(__dirname, 'backend/.env');
const backendPort = readEnv(backendEnvFile, 'PORT') ?? '6000';

module.exports = {
  apps: [
    {
      name: 'boxdiamonds-backend',
      cwd: path.join(__dirname, 'backend'),
      script: 'src/server.js',
      exec_mode: execMode,
      instances: Number(process.env.BACKEND_INSTANCES ?? 3),
      max_memory_restart: '1G',
      kill_timeout: 8000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'boxdiamonds-web',
      cwd: path.join(__dirname, 'web/server'),
      script: 'index.js',
      exec_mode: execMode,
      instances: Number(process.env.WEB_INSTANCES ?? 3),
      max_memory_restart: '600M',
      kill_timeout: 8000,
      env: {
        NODE_ENV: 'production',
        WEB_PORT: '6001',
        DATABASE_URL: readEnv(backendEnvFile, 'DATABASE_URL'),
        // Server-side rendering talks to the backend on this machine directly
        // (not through Cloudflare) — see web/src/api/client.ts.
        SSR_API_BASE_URL: `http://127.0.0.1:${backendPort}/api/v1`,
      },
    },
  ],
};
