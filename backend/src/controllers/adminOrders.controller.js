import {
  listOrdersQuerySchema,
  orderSummaryQuerySchema,
  updateOrderStatusSchema,
  markRefundedSchema,
} from '../validators/orders.validators.js';
import { withTransaction } from '../config/db.js';
import {
  findAllOrders,
  findOrderById,
  findOrderItems,
  findOrderStatusHistoryForAdmin,
  getOrderSummaryStats,
  updateOrderStatusTx,
  updateOrderStatusFieldsTx,
  insertOrderStatusHistoryTx,
  hasOrderStatusHistoryEntry,
} from '../repositories/orders.repository.js';
import {
  findShipmentByOrderId,
  findTrackingEventsByShipmentId,
  findReversePickupByReturnRequestId,
} from '../repositories/shipments.repository.js';
import { findWorkOrderPrints } from '../repositories/workOrderPrints.repository.js';
import { findInvoicePrints } from '../repositories/invoices.repository.js';
import { findReturnRequestByOrderId, updateReturnRequestStatus } from '../repositories/returnRequests.repository.js';
import { toOrderDto, toShipmentDto, orderDeliveryEstimateDto } from '../utils/orderDto.js';
import {
  assertManualTransitionAllowed,
  ORDER_STATUS_TO_LEGACY_STATUS,
  STOCK_RESTORABLE_ORDER_STATUSES,
  REFUND_TIMELINE_DAYS,
} from '../utils/orderStatus.js';
import { restoreStockForOrderTx, hasRestorableStock } from '../repositories/reservations.repository.js';
import { NotFoundError, AppError } from '../utils/AppError.js';
import { enqueueEmail } from '../services/emailService.js';

// Only order_status values with a real customer-facing template — a manual
// override to DELAYED (no template exists, and the spec's own §10
// notification list doesn't call for one) is a silent, email-free change.
// RETURNED sends the same "we've received your return" email as a
// courier-confirmed return. "Do not send multiple notifications for the same status" is
// enforced by the caller checking hasOrderStatusHistoryEntry BEFORE writing
// the new history row, not here.
const NOTIFY_TEMPLATE_FOR_STATUS = {
  PROCESSING: 'ORDER_PROCESSING',
  READY_TO_SHIP: 'ORDER_READY_TO_SHIP',
  CANCELLED: 'ORDER_CANCELLED',
  DELIVERY_FAILED: 'ORDER_DELIVERY_FAILED',
  RETURN_INITIATED: 'ORDER_RETURN_INITIATED',
  RETURNED: 'RETURN_RECEIVED',
};

async function notifyStatusChangeIfNew(order, status, alreadyNotified) {
  const template = NOTIFY_TEMPLATE_FOR_STATUS[status];
  if (!template || alreadyNotified) return;
  await enqueueEmail(order.contact_email, template, {
    orderId: order.id,
    contactName: order.contact_name,
    orderNumber: order.order_number,
    refundDays: REFUND_TIMELINE_DAYS,
  });
}

function toOrderListDto(order) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    shipmentStatus: order.shipment_status,
    contactName: order.contact_name,
    contactMobile: order.contact_mobile,
    totalAmount: Number(order.total_amount),
    createdAt: order.created_at,
    productName: order.first_product_name ?? null,
    itemCount: order.item_count ?? 0,
    deliveryEstimate: orderDeliveryEstimateDto(order),
  };
}

export async function list(req, res, next) {
  try {
    const q = listOrdersQuerySchema.parse(req.query);
    const { items, total } = await findAllOrders({
      status: q.status,
      search: q.search,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
    res.json({
      orders: items.map(toOrderListDto),
      page: q.page ?? 1,
      limit: q.limit ?? 20,
      total,
      totalPages: Math.ceil(total / (q.limit ?? 20)),
    });
  } catch (err) {
    next(err);
  }
}

// Sales card shown in the Orders page heading — one lightweight aggregate
// query, independent of pagination (matches dashboard.repository.js's
// revenue convention rather than summing whatever page happens to be loaded).
export async function summary(req, res, next) {
  try {
    const q = orderSummaryQuerySchema.parse(req.query);
    const stats = await getOrderSummaryStats({ status: q.status });
    const totalRevenue = Number(stats.total_revenue);
    const revenueOrderCount = stats.revenue_order_count;
    res.json({
      totalOrders: stats.total_orders,
      totalRevenue,
      averageOrderValue: revenueOrderCount > 0 ? totalRevenue / revenueOrderCount : 0,
      toFulfilCount: stats.to_fulfil_count,
      ordersToday: stats.orders_today,
    });
  } catch (err) {
    next(err);
  }
}

async function loadOrderDto(orderId) {
  const order = await findOrderById(orderId);
  if (!order) throw new NotFoundError('Order not found');
  const [items, statusHistory, shipment, hasProcessed, workOrderPrints, invoicePrints, returnRequest] =
    await Promise.all([
      findOrderItems(order.id),
      findOrderStatusHistoryForAdmin(order.id),
      findShipmentByOrderId(order.id),
      hasOrderStatusHistoryEntry(order.id, 'PROCESSING'),
      findWorkOrderPrints(order.id),
      findInvoicePrints(order.id),
      findReturnRequestByOrderId(order.id),
    ]);
  // Returned items go back on sale only when admin says so (after quality
  // check) — see restock() below.
  const canRestock = order.order_status === 'RETURNED' && (await hasRestorableStock(order.id));
  const trackingEvents = shipment ? await findTrackingEventsByShipmentId(shipment.id) : [];
  const reversePickup = returnRequest ? await findReversePickupByReturnRequestId(returnRequest.id) : null;
  return toOrderDto(
    order,
    items,
    statusHistory,
    {
      shipment: toShipmentDto(shipment, trackingEvents),
      canPrintWorkOrder: hasProcessed,
      workOrderPrintCount: workOrderPrints.length,
      canPrintInvoice: order.payment_status === 'PAID',
      invoiceNumber: order.invoice_number,
      invoicePrintCount: invoicePrints.length,
      canRestock,
      returnRequest: returnRequest
        ? {
            id: returnRequest.id,
            reason: returnRequest.reason,
            note: returnRequest.note,
            videoUrl: returnRequest.video_url,
            photoUrls: returnRequest.photo_urls ?? [],
            status: returnRequest.status,
            createdAt: returnRequest.created_at,
            resolvedAt: returnRequest.resolved_at,
            resolvedByAdminName: returnRequest.resolved_by_admin_name ?? null,
          }
        : null,
      reversePickup: reversePickup
        ? {
            id: reversePickup.id,
            provider: reversePickup.provider,
            courierName: reversePickup.courier_name,
            trackingNumber: reversePickup.tracking_number,
            status: reversePickup.status,
            createdAt: reversePickup.created_at,
            lastTrackedAt: reversePickup.last_tracked_at,
          }
        : null,
    },
    { forAdmin: true },
  );
}

export async function get(req, res, next) {
  try {
    res.json({ order: await loadOrderDto(req.params.id) });
  } catch (err) {
    next(err);
  }
}

// Dedicated Confirmed -> Processing action (spec §3) — separate from the
// generic override below so it can enforce its own precondition (must
// currently be Confirmed) without the generic endpoint's broader,
// admin-chosen-target transition table.
export async function startProcessing(req, res, next) {
  try {
    const existing = await findOrderById(req.params.id);
    if (!existing) throw new NotFoundError('Order not found');
    if (existing.order_status !== 'CONFIRMED') {
      throw new AppError(
        400,
        `Order must be Confirmed to start processing (currently ${existing.order_status ?? 'awaiting payment'})`,
      );
    }

    const alreadyNotified = await hasOrderStatusHistoryEntry(existing.id, 'PROCESSING');

    await withTransaction(async (client) => {
      await updateOrderStatusTx(client, existing.id, 'PROCESSING');
      await updateOrderStatusFieldsTx(client, existing.id, { orderStatus: 'PROCESSING' });
      await insertOrderStatusHistoryTx(client, existing.id, 'PROCESSING', null, {
        actor: req.admin.id,
        source: 'ADMIN',
      });
    });
    await notifyStatusChangeIfNew(existing, 'PROCESSING', alreadyNotified);

    res.json({ order: await loadOrderDto(existing.id) });
  } catch (err) {
    next(err);
  }
}

// Dedicated Processing -> Ready to Ship action — deliberately a pure status
// change with no courier call: it marks the parcel as physically packed and
// ready, before any AWB/shipment is created. Actually booking the shipment
// with the courier is a separate, later step (adminShipping.controller.js's
// createShipment), triggered by its own explicit "Create Shipment" action
// once the order is sitting at READY_TO_SHIP with no shipment yet — this
// split lets admin mark a batch of orders ready as they're packed without
// committing to a courier booking for each one immediately.
export async function markReadyToShip(req, res, next) {
  try {
    const existing = await findOrderById(req.params.id);
    if (!existing) throw new NotFoundError('Order not found');
    if (existing.order_status !== 'PROCESSING') {
      throw new AppError(
        400,
        `Order must be Processing to mark Ready to Ship (currently ${existing.order_status ?? 'awaiting payment'})`,
      );
    }

    const alreadyNotified = await hasOrderStatusHistoryEntry(existing.id, 'READY_TO_SHIP');

    await withTransaction(async (client) => {
      // No legacy `status` write — READY_TO_SHIP has no legacy equivalent
      // (see ORDER_STATUS_TO_LEGACY_STATUS).
      await updateOrderStatusFieldsTx(client, existing.id, { orderStatus: 'READY_TO_SHIP' });
      await insertOrderStatusHistoryTx(client, existing.id, 'READY_TO_SHIP', null, {
        actor: req.admin.id,
        source: 'ADMIN',
      });
    });
    await notifyStatusChangeIfNew(existing, 'READY_TO_SHIP', alreadyNotified);

    res.json({ order: await loadOrderDto(existing.id) });
  } catch (err) {
    next(err);
  }
}

// Manual admin override for the exception states (Cancelled, Delayed,
// Delivery Failed, Return Initiated, Returned) and Processing (redundant
// with startProcessing, kept for symmetry) — spec §7's transition table:
// courier-controlled statuses (Ready to Ship, Shipped, In Transit, Out for
// Delivery, Delivered) are deliberately NOT reachable here; those come from
// the Ready-to-Ship flow (Phase 3) or courier tracking, not a free-form
// admin dropdown. assertManualTransitionAllowed also rejects any change
// once the order is already in a terminal state (Delivered/Cancelled/
// Returned).
// Refunds are issued manually from the Cashfree dashboard (no refund API
// integration yet) — this only records that it happened. Allowed for a
// cancelled or returned order still marked PAID, i.e. exactly the orders
// the admin UI flags as "Refund pending".
const REFUNDABLE_ORDER_STATUSES = ['CANCELLED', 'RETURNED'];

export async function markRefunded(req, res, next) {
  try {
    const existing = await findOrderById(req.params.id);
    if (!existing) throw new NotFoundError('Order not found');
    const { reference } = markRefundedSchema.parse(req.body ?? {});
    if (!REFUNDABLE_ORDER_STATUSES.includes(existing.order_status) || existing.payment_status !== 'PAID') {
      throw new AppError(400, 'Only a cancelled or returned order with a pending refund can be marked as refunded');
    }

    await withTransaction(async (client) => {
      await updateOrderStatusFieldsTx(client, existing.id, { paymentStatus: 'REFUNDED' });
      await insertOrderStatusHistoryTx(
        client,
        existing.id,
        existing.order_status,
        `Refund issued to customer${reference ? ` — ref ${reference}` : ''}`,
        { actor: req.admin.id, source: 'ADMIN' },
      );
    });

    await enqueueEmail(existing.contact_email, 'REFUND_ISSUED', {
      orderId: existing.id,
      contactName: existing.contact_name,
      orderNumber: existing.order_number,
      amount: existing.total_amount,
      reference: reference ?? null,
      isReturn: existing.order_status === 'RETURNED',
    });

    res.json({ order: await loadOrderDto(existing.id) });
  } catch (err) {
    next(err);
  }
}

// "Add back to stock" for a returned order, once the piece has passed
// quality check. One-time: restoreStockForOrderTx releases the reservations
// it restocks, so a second call finds nothing to add.
export async function restock(req, res, next) {
  try {
    const existing = await findOrderById(req.params.id);
    if (!existing) throw new NotFoundError('Order not found');
    if (existing.order_status !== 'RETURNED') {
      throw new AppError(400, 'Only a returned order can be added back to stock');
    }
    if (!(await hasRestorableStock(existing.id))) {
      throw new AppError(400, "This order's items have already been added back to stock");
    }
    await withTransaction(async (client) => {
      await restoreStockForOrderTx(client, existing.id);
      await insertOrderStatusHistoryTx(client, existing.id, existing.order_status, 'Returned items added back to stock', {
        actor: req.admin.id,
        source: 'ADMIN',
      });
    });
    res.json({ order: await loadOrderDto(existing.id) });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const existing = await findOrderById(req.params.id);
    if (!existing) throw new NotFoundError('Order not found');

    const { status, note } = updateOrderStatusSchema.parse(req.body);
    assertManualTransitionAllowed(existing.order_status, status);

    const alreadyNotified = await hasOrderStatusHistoryEntry(existing.id, status);

    await withTransaction(async (client) => {
      const legacyStatus = ORDER_STATUS_TO_LEGACY_STATUS[status];
      if (legacyStatus) await updateOrderStatusTx(client, existing.id, legacyStatus);
      await updateOrderStatusFieldsTx(client, existing.id, { orderStatus: status });
      await insertOrderStatusHistoryTx(client, existing.id, status, note ?? 'Status updated by admin', {
        actor: req.admin.id,
        source: 'ADMIN',
      });
      // Put paid-for stock back — but only while the piece is still with us.
      // Once the courier has it (SHIPPED onward), restocking is a manual call.
      if (status === 'CANCELLED' && STOCK_RESTORABLE_ORDER_STATUSES.includes(existing.order_status)) {
        await restoreStockForOrderTx(client, existing.id);
      }
    });
    await notifyStatusChangeIfNew(existing, status, alreadyNotified);

    // The order actually completing its return is what closes out the
    // return request's own review trail — no separate admin action needed
    // for the common path (only reject uses the dedicated return-request
    // endpoint).
    if (status === 'RETURNED') {
      const returnRequest = await findReturnRequestByOrderId(existing.id);
      // Only an open/approved request completes — a REJECTED or CANCELLED
      // one stays as decided, even if the order is later marked RETURNED.
      if (returnRequest && ['REQUESTED', 'APPROVED'].includes(returnRequest.status)) {
        await updateReturnRequestStatus(returnRequest.id, 'COMPLETED', req.admin.id);
      }
    }

    res.json({ order: await loadOrderDto(existing.id) });
  } catch (err) {
    next(err);
  }
}
