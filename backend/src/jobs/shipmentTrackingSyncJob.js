import { boss, createQueueSafe } from './queue.js';
import { syncAllShipmentTracking } from '../services/shippingService.js';

export const JOB_SHIPMENT_TRACKING_SYNC = 'shipment-tracking-sync';

// Delhivery has no outbound webhook — this scheduled job (cadence:
// env.delhiveryTrackingSyncCron) is the only thing that ever advances
// shipment_status/order_status for a real courier shipment. See
// shippingService.js#syncAllShipmentTracking for the actual polling logic;
// this file only wires it into pg-boss.
async function shipmentTrackingSyncHandler() {
  await syncAllShipmentTracking();
}

export async function registerShipmentTrackingSyncWorker() {
  await createQueueSafe(JOB_SHIPMENT_TRACKING_SYNC);
  await boss.work(JOB_SHIPMENT_TRACKING_SYNC, shipmentTrackingSyncHandler);
}
