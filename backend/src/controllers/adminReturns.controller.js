import { withTransaction } from '../config/db.js';
import {
  findOrderById,
  updateOrderStatusTx,
  updateOrderStatusFieldsTx,
  insertOrderStatusHistoryTx,
} from '../repositories/orders.repository.js';
import { ORDER_STATUS_TO_LEGACY_STATUS } from '../utils/orderStatus.js';
import { findReturnRequestByOrderId, updateReturnRequestStatus } from '../repositories/returnRequests.repository.js';
import { findReversePickupByReturnRequestId } from '../repositories/shipments.repository.js';
import { updateReturnRequestStatusSchema } from '../validators/orders.validators.js';
import {
  createReversePickupForReturnRequest,
  syncReversePickupForReturnRequest,
  simulateReversePickupUpdate,
} from '../services/shippingService.js';
import { simulateReversePickupSchema } from '../validators/shipping.validators.js';
import { NotFoundError, AppError } from '../utils/AppError.js';

function toReturnRequestDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    reason: row.reason,
    note: row.note,
    videoUrl: row.video_url,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedByAdminName: row.resolved_by_admin_name ?? null,
  };
}

function toReversePickupDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    courierName: row.courier_name,
    trackingNumber: row.tracking_number,
    status: row.status,
    createdAt: row.created_at,
    lastTrackedAt: row.last_tracked_at,
  };
}

export async function get(req, res, next) {
  try {
    const order = await findOrderById(req.params.id);
    if (!order) throw new NotFoundError('Order not found');
    const returnRequest = await findReturnRequestByOrderId(order.id);
    const reversePickup = returnRequest ? await findReversePickupByReturnRequestId(returnRequest.id) : null;
    res.json({ returnRequest: toReturnRequestDto(returnRequest), reversePickup: toReversePickupDto(reversePickup) });
  } catch (err) {
    next(err);
  }
}

// Approve/Reject only — a lightweight review trail independent of
// order_status (which the admin continues to manage via the existing
// Change Status control, same as before this feature existed). COMPLETED
// is set automatically once the reverse pickup is confirmed received back
// at the warehouse (shippingService.js#syncOneReversePickup) — or, for an
// order with no reverse pickup on file, still via order_status moving to
// RETURNED through the existing Change Status control (adminOrders.controller.js
// ::updateStatus) — not through this endpoint either way.
export async function updateStatus(req, res, next) {
  try {
    const order = await findOrderById(req.params.id);
    if (!order) throw new NotFoundError('Order not found');
    const existing = await findReturnRequestByOrderId(order.id);
    if (!existing) throw new NotFoundError('No return request found for this order');
    if (existing.status !== 'REQUESTED') {
      throw new AppError(400, `Return request is already ${existing.status}`);
    }

    const { status } = updateReturnRequestStatusSchema.parse(req.body);
    await withTransaction(async (client) => {
      await updateReturnRequestStatus(existing.id, status, req.admin.id);
      if (status === 'REJECTED') {
        // A rejected return means the customer keeps the piece — the order
        // goes back to DELIVERED instead of sitting in RETURN_INITIATED.
        const revert = order.order_status === 'RETURN_INITIATED';
        if (revert) {
          await updateOrderStatusTx(client, order.id, ORDER_STATUS_TO_LEGACY_STATUS.DELIVERED);
          await updateOrderStatusFieldsTx(client, order.id, { orderStatus: 'DELIVERED' });
        }
        const historyStatus = revert ? 'DELIVERED' : order.order_status;
        await insertOrderStatusHistoryTx(client, order.id, historyStatus, 'Return request rejected by admin', {
          actor: req.admin.id,
          source: 'ADMIN',
        });
      } else {
        await insertOrderStatusHistoryTx(client, order.id, order.order_status, 'Return request approved by admin', {
          actor: req.admin.id,
          source: 'ADMIN',
        });
      }
    });
    const updated = await findReturnRequestByOrderId(order.id);
    res.json({ returnRequest: toReturnRequestDto(updated) });
  } catch (err) {
    next(err);
  }
}

// Only reachable once the return request is APPROVED — see
// createReversePickupForReturnRequest's own gate for the actual check;
// this repeats it in a 404-vs-400-friendly shape (unknown order/request vs.
// wrong status) rather than relying solely on the service's error.
export async function createReversePickup(req, res, next) {
  try {
    const order = await findOrderById(req.params.id);
    if (!order) throw new NotFoundError('Order not found');
    const returnRequest = await findReturnRequestByOrderId(order.id);
    if (!returnRequest) throw new NotFoundError('No return request found for this order');

    const shipment = await createReversePickupForReturnRequest(returnRequest.id, req.admin.id);
    res.status(201).json({ reversePickup: toReversePickupDto(shipment) });
  } catch (err) {
    next(err);
  }
}

export async function syncReversePickup(req, res, next) {
  try {
    const order = await findOrderById(req.params.id);
    if (!order) throw new NotFoundError('Order not found');
    const returnRequest = await findReturnRequestByOrderId(order.id);
    if (!returnRequest) throw new NotFoundError('No return request found for this order');

    const shipment = await syncReversePickupForReturnRequest(returnRequest.id);
    res.json({ reversePickup: toReversePickupDto(shipment) });
  } catch (err) {
    next(err);
  }
}

// Dev-only — see shippingService.simulateReversePickupUpdate. Meaningless
// against a real Delhivery waybill.
export async function simulateReversePickup(req, res, next) {
  try {
    const order = await findOrderById(req.params.id);
    if (!order) throw new NotFoundError('Order not found');
    const returnRequest = await findReturnRequestByOrderId(order.id);
    if (!returnRequest) throw new NotFoundError('No return request found for this order');

    const { status } = simulateReversePickupSchema.parse(req.body);
    const shipment = await simulateReversePickupUpdate(returnRequest.id, status);
    res.json({ reversePickup: toReversePickupDto(shipment) });
  } catch (err) {
    next(err);
  }
}
