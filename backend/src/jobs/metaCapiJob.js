import { boss } from './queue.js';
import { sendPurchaseEvent, isMetaCapiEnabled } from '../services/metaCapiService.js';

export const JOB_META_CAPI_PURCHASE = 'meta-capi-purchase';

// One job per paid order, queued after the payment transaction commits —
// so a slow or failing Meta API can never delay or break an order.
// pg-boss retries failures with backoff.
async function metaCapiPurchaseHandler(jobs) {
  const [job] = jobs;
  const result = await sendPurchaseEvent(job.data.orderId);
  if (result?.eventsReceived !== undefined) {
    console.log(`[meta-capi] Purchase sent for order ${job.data.orderId} (events_received=${result.eventsReceived})`);
  }
}

export async function registerMetaCapiWorker() {
  await boss.createQueue(JOB_META_CAPI_PURCHASE, { retryLimit: 5, retryDelay: 60, retryBackoff: true });
  await boss.work(JOB_META_CAPI_PURCHASE, metaCapiPurchaseHandler);
}

export async function enqueueMetaPurchase(orderId) {
  if (!isMetaCapiEnabled()) return;
  try {
    await boss.send(JOB_META_CAPI_PURCHASE, { orderId }, { singletonKey: `meta-purchase-${orderId}` });
  } catch (err) {
    console.error('[meta-capi] could not queue Purchase', orderId, err.message);
  }
}
