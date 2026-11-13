import { createApp } from './app.js';
import { env } from './config/env.js';
import { boss, startJobQueue, stopJobQueue } from './jobs/queue.js';
import { registerPricingWorkers, JOB_GOLD_RATE_SYNC } from './jobs/pricingJobs.js';
import { registerPricingRuleWorkers, JOB_PRICING_RULE_STATUS_SWEEP } from './jobs/pricingRuleJobs.js';
import { registerReservationSweepWorker, JOB_RESERVATION_SWEEP } from './jobs/reservationSweepJob.js';
import { registerAiImageWorker } from './jobs/aiImageJob.js';
import { registerAiStudioWorker } from './jobs/aiStudioJob.js';
import { registerProductSizeImageWorker } from './jobs/productSizeImageJob.js';
import { registerEmailWorker } from './jobs/emailJob.js';
import { registerMetaCapiWorker } from './jobs/metaCapiJob.js';
import { registerShipmentTrackingSyncWorker, JOB_SHIPMENT_TRACKING_SYNC } from './jobs/shipmentTrackingSyncJob.js';

const app = createApp();

// Without these, an unhandled rejection anywhere (a missed .catch on a
// background job, a third-party SDK call, etc.) crashes the whole process
// via Node's default behavior, dropping every in-flight request — including
// unrelated ones like admin login. Log and keep serving instead.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception', err);
});

async function main() {
  await startJobQueue();
  await registerPricingWorkers();
  await registerPricingRuleWorkers();
  await registerReservationSweepWorker();
  await registerAiImageWorker();
  await registerAiStudioWorker();
  await registerProductSizeImageWorker();
  await registerEmailWorker();
  await registerMetaCapiWorker();
  await registerShipmentTrackingSyncWorker();
  // schedule() is idempotent by job name — safe to call on every boot.
  await boss.schedule(JOB_GOLD_RATE_SYNC, env.goldRateSyncCron);
  await boss.schedule(JOB_RESERVATION_SWEEP, env.reservationSweepCron);
  await boss.schedule(JOB_SHIPMENT_TRACKING_SYNC, env.delhiveryTrackingSyncCron);
  await boss.schedule(JOB_PRICING_RULE_STATUS_SWEEP, env.pricingRuleStatusSweepCron);

  const server = app.listen(env.port, () => {
    console.log(`backend listening on http://localhost:${env.port} [${env.nodeEnv}]`);
  });

  const shutdown = async () => {
    server.close();
    await stopJobQueue();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
