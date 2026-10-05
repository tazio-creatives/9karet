import { withTransaction } from '../config/db.js';
import { AppError, NotFoundError, ForbiddenError } from '../utils/AppError.js';
import { shippingProvider, shippingProviders, resolveShippingProvider } from '../providers/shipping/index.js';
import {
  findShipmentByOrderId,
  findReversePickupByReturnRequestId,
  insertShipment,
  findShipmentByProviderShipmentIdTx,
  updateShipmentStatusTx,
  updateShipmentStatusSimpleTx,
  updateShipmentTrackingTx,
  touchShipmentTrackedAt,
  findShipmentsPendingTracking,
  insertShipmentTrackingEvent,
  insertShipmentTrackingEventTx,
} from '../repositories/shipments.repository.js';
import {
  findOrderById,
  findOrderItems,
  updateOrderStatusTx,
  updateOrderStatusFieldsTx,
  insertOrderStatusHistoryTx,
  hasOrderStatusHistoryEntry,
} from '../repositories/orders.repository.js';
import { findReturnRequestById, completeReturnRequestTx } from '../repositories/returnRequests.repository.js';
import { ORDER_STATUS_TO_LEGACY_STATUS } from '../utils/orderStatus.js';
import { enqueueEmail } from './emailService.js';
import { restoreStockForOrderTx } from '../repositories/reservations.repository.js';

// Actually books the shipment with the courier — only reachable once an
// admin has already marked the order READY_TO_SHIP (adminOrders.controller.js
// ::markReadyToShip, a separate pure status change with no courier call).
// order_status stays READY_TO_SHIP here; only shipment_status advances.
// Courier-controlled statuses beyond this point (Shipped, In Transit, Out
// for Delivery, Delivered) are driven by the tracking-sync job below, never
// set directly by an admin action. No label fetch — admin prints the
// shipping label from the Delhivery portal directly, not this platform.
export async function createShipmentForOrder(orderId, packageDetails, actorAdminId) {
  const order = await findOrderById(orderId);
  if (!order) throw new NotFoundError('Order not found');
  if (order.order_status !== 'READY_TO_SHIP') {
    throw new AppError(400, `Order must be Ready to Ship to create a shipment (currently ${order.order_status ?? 'awaiting payment'})`);
  }

  const existing = await findShipmentByOrderId(orderId);
  if (existing) throw new AppError(400, 'A shipment already exists for this order');

  // The admin picks the courier per shipment (Create Shipment dialog);
  // omitted, it falls back to the SHIPPING_PROVIDER default.
  const provider = resolveShippingProvider(packageDetails.provider);

  const serviceability = await provider.checkServiceability(order.shipping_address.pincode);
  if (!serviceability.serviceable) {
    throw new AppError(
      400,
      `Delivery pincode ${order.shipping_address.pincode} is not serviceable by ${provider.displayName}` +
        (serviceability.reason ? ` — ${serviceability.reason}.` : '.') +
        ' Use another courier for this order or contact the courier.',
    );
  }

  const items = await findOrderItems(orderId);
  const result = await provider.createShipment({ order, items, packageDetails });

  const shipment = await insertShipment({
    orderId,
    provider: provider.name,
    providerShipmentId: result.waybill,
    trackingNumber: result.waybill,
    courierName: result.courierName,
    status: 'SHIPMENT_CREATED',
    packageWeightGrams: packageDetails.weightGrams,
    packageLengthCm: packageDetails.lengthCm,
    packageWidthCm: packageDetails.widthCm,
    packageHeightCm: packageDetails.heightCm,
  });

  await withTransaction(async (client) => {
    await updateOrderStatusFieldsTx(client, orderId, { shipmentStatus: 'SHIPMENT_CREATED' });
    await insertOrderStatusHistoryTx(
      client,
      orderId,
      'READY_TO_SHIP',
      `Shipment created via ${shipment.courier_name} — AWB ${shipment.tracking_number}`,
      { actor: actorAdminId, source: 'ADMIN' },
    );
    await insertShipmentTrackingEventTx(client, {
      shipmentId: shipment.id,
      status: 'SHIPMENT_CREATED',
      note: `Shipment created via ${shipment.courier_name}${shipment.tracking_number ? ` — AWB ${shipment.tracking_number}` : ''}`,
      source: 'SYSTEM',
    });
  });

  return shipment;
}

export async function cancelShipmentForOrder(orderId, actorAdminId) {
  const shipment = await findShipmentByOrderId(orderId);
  if (!shipment) throw new NotFoundError('No shipment exists for this order');
  if (shipment.status === 'CANCELLED' || shipment.status === 'DELIVERED') {
    throw new AppError(400, `Cannot cancel a shipment that is already ${shipment.status}`);
  }

  const provider = shippingProviders[shipment.provider] ?? shippingProvider;
  await provider.cancelShipment(shipment.provider_shipment_id);

  await withTransaction(async (client) => {
    // Not yet picked up by the courier — the piece is still with us, so the
    // paid-for stock goes back (see STOCK_RESTORABLE_ORDER_STATUSES).
    if (shipment.status === 'SHIPMENT_CREATED') {
      await restoreStockForOrderTx(client, orderId);
    }
    await updateShipmentStatusSimpleTx(client, shipment.id, 'CANCELLED');
    await updateOrderStatusTx(client, orderId, 'CANCELLED');
    await updateOrderStatusFieldsTx(client, orderId, { orderStatus: 'CANCELLED', shipmentStatus: 'CANCELLED' });
    await insertOrderStatusHistoryTx(client, orderId, 'CANCELLED', 'Shipment cancelled', {
      actor: actorAdminId,
      source: 'ADMIN',
    });
    await insertShipmentTrackingEventTx(client, {
      shipmentId: shipment.id,
      status: 'CANCELLED',
      source: 'SYSTEM',
    });
  });

  const order = await findOrderById(orderId);
  await enqueueEmail(order.contact_email, 'ORDER_CANCELLED', {
    contactName: order.contact_name,
    orderNumber: order.order_number,
  });

  return findShipmentByOrderId(orderId);
}

// Books a real courier collection from the customer's address — gated on
// the return request actually being APPROVED (an admin decision), not just
// REQUESTED: scheduling a pickup before anyone has reviewed the return
// would send a courier to the customer's door for something that might get
// rejected. Mirrors createShipmentForOrder's shape (serviceability check,
// provider call, insert + tracking event) with a REVERSE-direction row.
export async function createReversePickupForReturnRequest(returnRequestId, actorAdminId) {
  const returnRequest = await findReturnRequestById(returnRequestId);
  if (!returnRequest) throw new NotFoundError('Return request not found');
  if (returnRequest.status !== 'APPROVED') {
    throw new AppError(400, `Reverse pickup can only be scheduled for an approved return request (currently ${returnRequest.status})`);
  }

  const existing = await findReversePickupByReturnRequestId(returnRequestId);
  if (existing) throw new AppError(400, 'A reverse pickup already exists for this return request');

  const order = await findOrderById(returnRequest.order_id);
  if (!order) throw new NotFoundError('Order not found');

  const serviceability = await shippingProvider.checkServiceability(order.shipping_address.pincode);
  if (!serviceability.serviceable) {
    throw new AppError(
      400,
      `Pickup pincode ${order.shipping_address.pincode} is not serviceable by ${shippingProvider.displayName}` +
        (serviceability.reason ? ` — ${serviceability.reason}.` : '.') +
        ' Arrange the return pickup manually or contact the courier.',
    );
  }

  const result = await shippingProvider.createReversePickup({ order, returnRequest });

  const shipment = await insertShipment({
    orderId: order.id,
    provider: shippingProvider.name,
    providerShipmentId: result.waybill,
    trackingNumber: result.waybill,
    courierName: result.courierName,
    status: 'REVERSE_PICKUP_SCHEDULED',
    direction: 'REVERSE',
    returnRequestId,
  });

  await withTransaction(async (client) => {
    await insertShipmentTrackingEventTx(client, {
      shipmentId: shipment.id,
      status: 'REVERSE_PICKUP_SCHEDULED',
      note: `Reverse pickup scheduled via ${shipment.courier_name} — AWB ${shipment.tracking_number}`,
      source: 'MANUAL',
    });
    // Note-only — order_status itself is untouched (reverse pickup doesn't
    // drive the customer-facing order status, only the return request).
    await insertOrderStatusHistoryTx(
      client,
      order.id,
      order.order_status,
      `Reverse pickup scheduled via ${shipment.courier_name} — AWB ${shipment.tracking_number}`,
      { actor: actorAdminId, source: 'ADMIN' },
    );
  });

  return shipment;
}

const TRACKING_TO_ORDER_STATUS = {
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
};

// Public courier webhook — kept for the stub provider's dev "simulate
// tracking" shortcut below. Delhivery itself doesn't call this: it has no
// outbound webhook, only a pull API, which is why the real sync path is
// syncAllShipmentTracking() further down, not this function.
export async function confirmTrackingUpdate(rawBody, signature) {
  if (!shippingProvider.verifySignature(rawBody, signature)) {
    throw new ForbiddenError('Invalid webhook signature');
  }

  const payload = JSON.parse(rawBody);
  const { providerShipmentId, status } = payload;
  if (!providerShipmentId || !TRACKING_TO_ORDER_STATUS[status]) {
    throw new AppError(400, 'Malformed webhook payload');
  }

  const result = await withTransaction(async (client) => {
    const shipment = await findShipmentByProviderShipmentIdTx(client, providerShipmentId);
    if (!shipment) throw new NotFoundError('Unknown shipment reference');

    if (shipment.status === status) {
      return { alreadyProcessed: true, shipment };
    }

    const updated = await updateShipmentStatusTx(client, shipment.id, status, payload);
    await updateOrderStatusTx(client, shipment.order_id, TRACKING_TO_ORDER_STATUS[status]);
    await updateOrderStatusFieldsTx(client, shipment.order_id, {
      orderStatus: TRACKING_TO_ORDER_STATUS[status],
      shipmentStatus: status,
    });
    await insertOrderStatusHistoryTx(
      client,
      shipment.order_id,
      TRACKING_TO_ORDER_STATUS[status],
      `Courier update: ${status}`,
    );
    await insertShipmentTrackingEventTx(client, {
      shipmentId: shipment.id,
      status,
      source: 'WEBHOOK',
    });

    return { alreadyProcessed: false, shipment: updated };
  });

  if (!result.alreadyProcessed) {
    const order = await findOrderById(result.shipment.order_id);
    const template = status === 'DELIVERED' ? 'ORDER_DELIVERED' : 'ORDER_OUT_FOR_DELIVERY';
    await enqueueEmail(order.contact_email, template, {
      orderId: order.id,
      contactName: order.contact_name,
      orderNumber: order.order_number,
    });
  }

  return result;
}

// Admin manually logging a tracking update — a free-text history entry,
// independent of the shipment's own `status` field.
export async function addManualTrackingEvent(orderId, { status, location, note }) {
  const shipment = await findShipmentByOrderId(orderId);
  if (!shipment) throw new NotFoundError('No shipment exists for this order');

  return insertShipmentTrackingEvent({
    shipmentId: shipment.id,
    status,
    location,
    note,
    source: 'MANUAL',
  });
}

// Dev-only stand-in for a real courier calling in — mirrors
// paymentService.simulatePayment: builds a properly signed payload and runs
// it through the exact same confirmTrackingUpdate() the public webhook
// uses. Stub-provider-only; meaningless against a real Delhivery shipment.
export async function simulateTrackingUpdate(orderId, status) {
  const shipment = await findShipmentByOrderId(orderId);
  if (!shipment) throw new NotFoundError('No shipment exists for this order');

  const { body, signature } = shippingProvider.signPayload({
    providerShipmentId: shipment.provider_shipment_id,
    status,
  });
  return confirmTrackingUpdate(body, signature);
}

// Delhivery's own tracking status strings, mapped onto our SHIPMENT_STATUSES
// vocabulary (utils/orderStatus.js). Deliberately conservative — an
// unrecognized status is left alone (raw payload still gets logged as a
// tracking event's note) rather than guessed at, per the plan's "do not
// guess undocumented endpoint details" caution.
const DELHIVERY_STATUS_MAP = {
  Manifested: 'SHIPMENT_CREATED',
  'Not Picked': 'SHIPMENT_CREATED',
  'Picked Up': 'PICKED_UP',
  Dispatched: 'IN_TRANSIT',
  'In Transit': 'IN_TRANSIT',
  Pending: 'IN_TRANSIT',
  'Reached Destination': 'REACHED_DESTINATION',
  'Out for Delivery': 'OUT_FOR_DELIVERY',
  Delivered: 'DELIVERED',
  Delayed: 'DELAYED',
  'Delivery Failed': 'DELIVERY_FAILED',
  Undelivered: 'DELIVERY_FAILED',
  RTO: 'RTO_INITIATED',
  DTO: 'RTO_INITIATED',
  'RTO Delivered': 'RETURNED',
  Cancelled: 'CANCELLED',
};

// shipment_status -> order_status (spec §5's mapping table) — several
// granular courier states collapse onto one customer-facing order status.
const SHIPMENT_TO_ORDER_STATUS = {
  SHIPMENT_CREATED: 'READY_TO_SHIP',
  PICKED_UP: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  REACHED_DESTINATION: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  DELAYED: 'DELAYED',
  DELIVERY_FAILED: 'DELIVERY_FAILED',
  RTO_INITIATED: 'RETURN_INITIATED',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
};

const NOTIFY_TEMPLATE_FOR_SHIPMENT_STATUS = {
  PICKED_UP: 'ORDER_SHIPPED',
  OUT_FOR_DELIVERY: 'ORDER_OUT_FOR_DELIVERY',
  DELIVERED: 'ORDER_DELIVERED',
  DELIVERY_FAILED: 'ORDER_DELIVERY_FAILED',
};

// Same raw Delhivery tracking-status vocabulary as a forward shipment (the
// /api/v1/packages/json/ tracking call is generic — it doesn't distinguish
// forward/reverse), reinterpreted for the opposite direction: "Delivered"
// here means delivered back to OUR warehouse, not to the customer, which is
// why this uses its own REVERSE_-prefixed terminal names rather than
// reusing DELIVERED/CANCELLED (those would read backwards in shared UI).
const DELHIVERY_REVERSE_STATUS_MAP = {
  Manifested: 'REVERSE_PICKUP_SCHEDULED',
  'Not Picked': 'REVERSE_PICKUP_SCHEDULED',
  'Picked Up': 'REVERSE_PICKED_UP',
  Dispatched: 'REVERSE_IN_TRANSIT',
  'In Transit': 'REVERSE_IN_TRANSIT',
  Pending: 'REVERSE_IN_TRANSIT',
  'Reached Destination': 'REVERSE_IN_TRANSIT',
  Delivered: 'REVERSE_RECEIVED',
  Delayed: 'REVERSE_IN_TRANSIT',
  Undelivered: 'REVERSE_PICKUP_FAILED',
  Cancelled: 'REVERSE_PICKUP_CANCELLED',
};

const REVERSE_PICKUP_STATUSES = new Set(Object.values(DELHIVERY_REVERSE_STATUS_MAP));

// Shared by the real tracking sync and the dev-only simulate action below —
// applies a new reverse-pickup status and, if it's the terminal
// "item is physically back with us" state, completes the return request.
async function applyReversePickupStatus(shipment, status, { source, note, raw = null }) {
  await withTransaction(async (client) => {
    await updateShipmentTrackingTx(client, shipment.id, status, raw);
    await insertShipmentTrackingEventTx(client, { shipmentId: shipment.id, status, note, source });
    // The item is physically back with us — this is what actually
    // completes the return, replacing the old fully-manual "admin sets
    // order_status to RETURNED" path with a courier-confirmed signal.
    // The order itself moves to RETURNED at the same moment, so the
    // customer's order page and admin's list both show the return as done.
    if (status === 'REVERSE_RECEIVED') {
      await completeReturnRequestTx(client, shipment.return_request_id);
      const order = await findOrderById(shipment.order_id);
      if (order && order.order_status === 'RETURN_INITIATED') {
        await updateOrderStatusTx(client, order.id, ORDER_STATUS_TO_LEGACY_STATUS.RETURNED);
        await updateOrderStatusFieldsTx(client, order.id, { orderStatus: 'RETURNED' });
        // Tracking events use MANUAL for admin-driven updates; order history
        // calls that ADMIN.
        await insertOrderStatusHistoryTx(client, order.id, 'RETURNED', 'Returned item received back at the warehouse', {
          source: source === 'MANUAL' ? 'ADMIN' : source,
        });
      }
    }
  });
}

// Dev-only — lets an admin walk a stub-provider reverse pickup through its
// lifecycle without a real courier, mirroring simulateTrackingUpdate's role
// for forward shipments. Meaningless against a real Delhivery waybill (the
// next real tracking sync would just overwrite whatever status this sets).
export async function simulateReversePickupUpdate(returnRequestId, status) {
  if (!REVERSE_PICKUP_STATUSES.has(status)) {
    throw new AppError(400, `Unrecognized reverse pickup status: ${status}`);
  }
  const shipment = await findReversePickupByReturnRequestId(returnRequestId);
  if (!shipment) throw new NotFoundError('No reverse pickup exists for this return request');

  await applyReversePickupStatus(shipment, status, { source: 'MANUAL', note: `Simulated: ${status}` });
  return findReversePickupByReturnRequestId(returnRequestId);
}

async function syncOneReversePickup(shipment) {
  const provider = shippingProviders[shipment.provider];
  if (!provider || typeof provider.trackShipment !== 'function' || !shipment.tracking_number) {
    return null;
  }

  const result = await provider.trackShipment(shipment.tracking_number, shipment.status);
  const mapped = result.status ? DELHIVERY_REVERSE_STATUS_MAP[result.status] : null;

  if (!mapped || mapped === shipment.status) {
    await touchShipmentTrackedAt(shipment.id);
    return null;
  }

  await applyReversePickupStatus(shipment, mapped, {
    source: provider.trackingSource ?? 'DELHIVERY',
    note: result.instructions ?? result.status,
    raw: result.raw,
  });

  return { shipmentId: shipment.id, orderId: shipment.order_id, from: shipment.status, to: mapped };
}

async function syncOneShipment(shipment) {
  if (shipment.direction === 'REVERSE') return syncOneReversePickup(shipment);

  const provider = shippingProviders[shipment.provider];
  if (!provider || typeof provider.trackShipment !== 'function' || !shipment.tracking_number) {
    return null;
  }

  const result = await provider.trackShipment(shipment.tracking_number, shipment.status);
  // Each courier has its own raw status vocabulary — a provider supplies its
  // own map (e.g. Blue Dart's forwardStatusMap); Delhivery's lives here.
  const statusMap = provider.forwardStatusMap ?? DELHIVERY_STATUS_MAP;
  const source = provider.trackingSource ?? 'DELHIVERY';
  const mapped = result.status ? statusMap[result.status] : null;

  if (!mapped) {
    // Nothing we recognize changed — still record that we checked, so the
    // "least recently checked" poll ordering doesn't get stuck on one
    // shipment forever.
    await touchShipmentTrackedAt(shipment.id);
    return null;
  }
  if (mapped === shipment.status) {
    await touchShipmentTrackedAt(shipment.id);
    return null;
  }

  const orderStatus = SHIPMENT_TO_ORDER_STATUS[mapped];
  const alreadyNotified = await hasOrderStatusHistoryEntry(shipment.order_id, orderStatus);

  await withTransaction(async (client) => {
    await updateShipmentTrackingTx(client, shipment.id, mapped, result.raw);
    await updateOrderStatusFieldsTx(client, shipment.order_id, { orderStatus, shipmentStatus: mapped });
    await insertOrderStatusHistoryTx(client, shipment.order_id, orderStatus, `Courier update: ${result.status}`, {
      source,
    });
    await insertShipmentTrackingEventTx(client, {
      shipmentId: shipment.id,
      status: mapped,
      note: result.instructions ?? result.status,
      source,
    });
  });

  const template = NOTIFY_TEMPLATE_FOR_SHIPMENT_STATUS[mapped];
  if (template && !alreadyNotified) {
    const order = await findOrderById(shipment.order_id);
    await enqueueEmail(order.contact_email, template, {
      orderId: order.id,
      contactName: order.contact_name,
      orderNumber: order.order_number,
    });
  }

  return { shipmentId: shipment.id, orderId: shipment.order_id, from: shipment.status, to: mapped };
}

// Scheduled job entry point (jobs/shipmentTrackingSyncJob.js) — polls every
// shipment not yet in a terminal state. One shipment's failure (a timeout,
// a malformed response) is logged and skipped rather than aborting the
// whole batch.
export async function syncAllShipmentTracking() {
  const shipments = await findShipmentsPendingTracking();
  const results = [];
  for (const shipment of shipments) {
    try {
      const result = await syncOneShipment(shipment);
      if (result) results.push(result);
    } catch (err) {
      console.error(`[shipment-tracking-sync] shipment ${shipment.id} failed:`, err.message);
    }
  }
  return results;
}

// Admin "Refresh Tracking" button — syncs just the one order's shipment on
// demand instead of waiting for the next scheduled run.
export async function syncOneShipmentTrackingForOrder(orderId) {
  const shipment = await findShipmentByOrderId(orderId);
  if (!shipment) throw new NotFoundError('No shipment exists for this order');
  await syncOneShipment(shipment);
  return findShipmentByOrderId(orderId);
}

// Same on-demand refresh, for a return request's reverse pickup.
export async function syncReversePickupForReturnRequest(returnRequestId) {
  const shipment = await findReversePickupByReturnRequestId(returnRequestId);
  if (!shipment) throw new NotFoundError('No reverse pickup exists for this return request');
  await syncOneReversePickup(shipment);
  return findReversePickupByReturnRequestId(returnRequestId);
}

