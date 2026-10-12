import PgBoss from 'pg-boss';
import { env } from '../config/env.js';

// Postgres-backed job queue (plan §2: "no Redis needed") — runs in the same
// process as the API server for now; nothing in the design prevents
// splitting it into a separate worker process later if load requires it.
export const boss = new PgBoss({ connectionString: env.databaseUrl });

export async function startJobQueue() {
  boss.on('error', (err) => console.error('[pg-boss]', err));
  await boss.start();
}

export async function stopJobQueue() {
  await boss.stop({ graceful: true });
}

// createQueue is idempotent, but several backend copies (pm2 cluster mode)
// boot at once and race to create the same queue — Postgres can then abort
// one with a deadlock (40P01) or a unique violation (23505), which crashed
// that copy's startup. Retry briefly instead; the queue exists by then.
export async function createQueueSafe(name, options) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await boss.createQueue(name, options);
    } catch (err) {
      if (attempt >= 5 || !['40P01', '23505', '40001'].includes(err.code)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt + Math.random() * 300));
    }
  }
}
