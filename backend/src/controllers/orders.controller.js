import { withTransaction } from '../config/db.js';
import { listOrdersQuerySchema, cancelOrderSchema } from '../validators/orders.validators.js';
import {
  findOrderByIdForUpdateTx,
  updateOrderStatusTx,
  updateOrderStatusFieldsTx,
  insertOrderStatusHistoryTx,
  findOrderById,
  findOrdersByUser,
  findOrderListExtras,
  findOrderItems,
  findOrderStatusHistory,
  getOrderStatsForUser,
} from '../repositories/orders.repository.js';
import { findShipmentByOrderId, findTrackingEventsByShipmentId } from '../repositories/shipments.repository.js';
import { findReviewsByOrderItemIds, findImagesByReviewIds } from '../repositories/reviews.repository.js';
import { toOrderDto, toShipmentDto, orderDeliveryEstimateDto } from '../utils/orderDto.js';
import { restoreStockForOrderTx } from '../repositories/reservations.repository.js';
import { enqueueEmail } from '../services/emailService.js';
import {
  CUSTOMER_CANCELLABLE_ORDER_STATUSES,
  CUSTOMER_CANCEL_REASON_LABELS,
  ORDER_STATUS_TO_LEGACY_STATUS,
  REFUND_TIMELINE_DAYS,
} from '../utils/orderStatus.js';
import { NotFoundError, AppError } from '../utils/AppError.js';
import { findNonReturnableProductIds } from '../repositories/products.repository.js';

// Card-shaped list DTO, plus the account "My Orders" card's preview
// (item count/thumbnail) and progress-stepper timestamps — still no full
// items/history/shipment payload, just what that one screen needs (plan §13).
function toOrderListDto(order, extras) {
  const milestones = extras.milestones.get(order.id) ?? {};
  const preview = extras.previews.get(order.id) ?? null;
  return {
    id: order.id,
    orderNumber: order.order_number,
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    totalAmount: Number(order.total_amount),
    createdAt: order.created_at,
    itemCount: extras.itemCounts.get(order.id) ?? 0,
    previewProductName: preview?.productName ?? null,
    previewImageUrl: preview?.imageUrl ?? null,
    confirmedAt: milestones.CONFIRMED ?? null,
    processingAt: milestones.PROCESSING ?? null,
    readyToShipAt: milestones.READY_TO_SHIP ?? null,
    shippedAt: milestones.SHIPPED ?? null,
    inTransitAt: milestones.IN_TRANSIT ?? null,
    outForDeliveryAt: milestones.OUT_FOR_DELIVERY ?? null,
    deliveredAt: milestones.DELIVERED ?? null,
    deliveryEstimate: orderDeliveryEstimateDto(order),
  };
}

export async function list(req, res, next) {
  try {
    const q = listOrdersQuerySchema.parse(req.query);
    const { items, total } = await findOrdersByUser(req.customer.id, {
      status: q.status,
      page: q.page ?? 1,
      limit: q.limit ?? 10,
    });
    const extras = await findOrderListExtras(items.map((o) => o.id));
    res.json({
      orders: items.map((o) => toOrderListDto(o, extras)),
      page: q.page ?? 1,
      limit: q.limit ?? 10,
      total,
      totalPages: Math.ceil(total / (q.limit ?? 10)),
    });
  } catch (err) {
    next(err);
  }
}

export async function stats(req, res, next) {
  try {
    const row = await getOrderStatsForUser(req.customer.id);
    res.json({
      totalOrders: row.total_orders,
      activeOrders: row.active_orders,
      totalSpent: Number(row.total_spent),
    });
  } catch (err) {
    next(err);
  }
}

async function loadOwnedOrder(req) {
  const order = await findOrderById(req.params.id);
  if (!order || order.user_id !== req.customer.id) throw new NotFoundError('Order not found');
  return order;
}

// Customer self-cancellation, allowed only while the order is still
// CONFIRMED (paid, not yet picked up for processing). Re-checked under a row
// lock so a concurrent admin "Start Processing" can't slip in between the
// check and the write. Stock the payment decremented is restored; the refund
// itself is manual (admin refunds via Cashfree, then "Mark as Refunded"),
// so payment_status deliberately stays PAID here — CANCELLED + PAID is what
// surfaces as "Refund pending" to admin and "Refund in progress" to the
// customer.
export async function cancel(req, res, next) {
  try {
    const owned = await loadOwnedOrder(req);
    const { reason, note } = cancelOrderSchema.parse(req.body);

    const notePart = note ? ` — "${note}"` : '';
    const historyNote = `Cancelled by customer (${CUSTOMER_CANCEL_REASON_LABELS[reason]})${notePart}`;

    await withTransaction(async (client) => {
      const order = await findOrderByIdForUpdateTx(client, owned.id);
      if (!CUSTOMER_CANCELLABLE_ORDER_STATUSES.includes(order.order_status)) {
        throw new AppError(
          400,
          'This order can no longer be cancelled — it is already being processed. Please contact support.',
        );
      }
      await updateOrderStatusTx(client, order.id, ORDER_STATUS_TO_LEGACY_STATUS.CANCELLED);
      await updateOrderStatusFieldsTx(client, order.id, { orderStatus: 'CANCELLED' });
      await insertOrderStatusHistoryTx(client, order.id, 'CANCELLED', historyNote, { source: 'CUSTOMER' });
      await restoreStockForOrderTx(client, order.id);
    });

    await enqueueEmail(owned.contact_email, 'ORDER_CANCELLED_BY_CUSTOMER', {
      contactName: owned.contact_name,
      orderNumber: owned.order_number,
      totalAmount: Number(owned.total_amount),
      refundDays: REFUND_TIMELINE_DAYS,
    });

    res.json({ orderId: owned.id, orderStatus: 'CANCELLED', refundDays: REFUND_TIMELINE_DAYS });
  } catch (err) {
    next(err);
  }
}

export async function get(req, res, next) {
  try {
    const order = await loadOwnedOrder(req);
    const [items, statusHistory, shipment] = await Promise.all([
      findOrderItems(order.id),
      findOrderStatusHistory(order.id),
      findShipmentByOrderId(order.id),
    ]);
    // Customer-facing tracking timeline — same trackingEvents the admin
    // view shows (courier status/location/note), just without the
    // forAdmin:true flag that would add internal actor names to
    // statusHistory (see toOrderDto's comment on that flag).
    const trackingEvents = shipment ? await findTrackingEventsByShipmentId(shipment.id) : [];
    const dto = toOrderDto(order, items, statusHistory, { shipment: toShipmentDto(shipment, trackingEvents) });

    // "Write a Review" eligibility (plan §11a) — only meaningful once the
    // order has actually been delivered, and only for items not already
    // reviewed (the DB also enforces one review per order_item, this just
    // saves the customer from submitting a form that would 400). The
    // review itself (whatever its moderation status) is attached
    // regardless of the order's current status — a later status change
    // (e.g. a return) must not make an already-submitted review vanish
    // from the page.
    const reviews = await findReviewsByOrderItemIds(items.map((i) => i.id));
    const imagesByReviewId = await findImagesByReviewIds(reviews.map((r) => r.id));
    const reviewsByItemId = new Map(reviews.map((r) => [r.order_item_id, r]));
    dto.items = dto.items.map((item) => {
      const review = reviewsByItemId.get(item.id) ?? null;
      return {
        ...item,
        canReview: order.order_status === 'DELIVERED' && !review,
        review: review
          ? {
              id: review.id,
              rating: review.rating,
              title: review.title,
              body: review.body,
              status: review.status,
              images: imagesByReviewId.get(review.id) ?? [],
            }
          : null,
      };
    });

    // Non-returnable items (solitaire, custom…) limit the return form to
    // problem reasons — see orderReturns.controller.js.
    const nonReturnableIds = new Set(await findNonReturnableProductIds(items.map((i) => i.product_id).filter(Boolean)));
    dto.hasNonReturnableItems = nonReturnableIds.size > 0;
    dto.items = dto.items.map((item, i) => ({ ...item, nonReturnable: nonReturnableIds.has(items[i].product_id) }));

    res.json({ order: dto });
  } catch (err) {
    next(err);
  }
}
