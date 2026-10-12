import { boss, createQueueSafe } from './queue.js';
import { withTransaction } from '../config/db.js';
import {
  findExpiredActiveReservationOrderIds,
  releaseReservationsForOrderTx,
} from '../repositories/reservations.repository.js';
import { expireOrderIfPendingTx, insertOrderStatusHistoryTx } from '../repositories/orders.repository.js';

export const JOB_RESERVATION_SWEEP = 'reservation-expiry-sweep';

// plan §11 2b: releases reservations whose hold expired before payment
// confirmed, and moves the parent order to EXPIRED if it's still waiting on
// payment — one order per transaction so a bad row can't block the batch.
async function reservationSweepHandler() {
  const orderIds = await findExpiredActiveReservationOrderIds();
  for (const orderId of orderIds) {
    await withTransaction(async (client) => {
      await releaseReservationsForOrderTx(client, orderId);
      const expired = await expireOrderIfPendingTx(client, orderId);
      if (expired) {
        await insertOrderStatusHistoryTx(client, orderId, 'EXPIRED', 'Reservation expired before payment');
      }
    });
  }
}

export async function registerReservationSweepWorker() {
  await createQueueSafe(JOB_RESERVATION_SWEEP);
  await boss.work(JOB_RESERVATION_SWEEP, reservationSweepHandler);
}
