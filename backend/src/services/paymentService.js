import { withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError, NotFoundError, ForbiddenError } from '../utils/AppError.js';
import { paymentProvider } from '../providers/payment/index.js';
import {
  insertPayment,
  findPaymentByProviderRefTx,
  findPaymentByProviderRef,
  updatePaymentStatusTx,
} from '../repositories/payments.repository.js';
import {
  findOrderById,
  findOrderByIdTx,
  findOrderItems,
  updateOrderStatusTx,
  updateOrderStatusFieldsTx,
  insertOrderStatusHistoryTx,
} from '../repositories/orders.repository.js';
import {
  confirmReservationsForOrderTx,
  releaseReservationsForOrderTx,
} from '../repositories/reservations.repository.js';
import { findCartByOwnerTx, clearOrderedItemsFromCartTx } from '../repositories/carts.repository.js';
import { findProductsByIds } from '../repositories/products.repository.js';
import { invalidateProductsPagesBatch } from './pageCacheInvalidation.js';
import { enqueueEmail } from './emailService.js';
import { insertCouponUsageTx } from '../repositories/coupons.repository.js';
import { enqueueMetaPurchase } from '../jobs/metaCapiJob.js';

// Called right after checkoutService.createOrder() commits (plan §11) — a
// separate step because talking to a payment gateway is I/O that doesn't
// belong inside the DB transaction that reserved the stock.
export async function createPaymentIntent(order) {
  const intent = await paymentProvider.createIntent(order);
  const payment = await insertPayment({
    orderId: order.id,
    provider: intent.provider,
    providerRef: intent.providerRef,
    status: 'PENDING',
    amount: order.total_amount,
  });
  // paymentSessionId (Cashfree Drop-in) isn't a payments-table column — the
  // frontend only needs it once, immediately, to launch checkout, and the
  // stub doesn't have one at all.
  return { ...payment, paymentSessionId: intent.paymentSessionId };
}

// The only thing that ever confirms an order (plan §11 correction) — never
// trust the frontend's own "payment succeeded" redirect. Idempotent: a
// repeat delivery of the same providerRef's terminal outcome is a no-op.
export async function confirmPayment(rawBody, headers) {
  if (!paymentProvider.verifySignature(rawBody, headers)) {
    throw new ForbiddenError('Invalid webhook signature');
  }

  // Payload shape is provider-specific (stub's trivial {providerRef,status}
  // vs Cashfree's nested order/payment event envelope) — each provider owns
  // parsing its own wire format. null means "an event type we don't act on"
  // (e.g. a refund webhook), not an error — still 2xx it so the provider
  // doesn't retry-storm us for something we deliberately ignore.
  const event = paymentProvider.parseWebhookEvent(rawBody);
  if (!event) {
    return { alreadyProcessed: true, ignored: true };
  }
  const { providerRef, status } = event;
  if (!providerRef || !['SUCCEEDED', 'FAILED'].includes(status)) {
    throw new AppError(400, 'Malformed webhook payload');
  }

  const result = await withTransaction(async (client) => {
    const payment = await findPaymentByProviderRefTx(client, providerRef);
    if (!payment) throw new NotFoundError('Unknown payment reference');

    // Gated on the ORDER's status, not the payment row's. Cashfree lets a
    // shopper retry a failed attempt with a different method inside the
    // same checkout session — same providerRef, a second webhook delivery.
    // Gating on payment.status (as before) would treat that as
    // "already processed" because the row is still FAILED from the first
    // attempt, silently dropping a genuine successful payment. Order status
    // is the real "is this actually done" signal, and it's still protected
    // by the FOR UPDATE lock on the payment row above (one providerRef ->
    // one payment row -> one order, so concurrent deliveries still
    // serialize here).
    const order = await findOrderByIdTx(client, payment.order_id);
    if (order.status !== 'PENDING_PAYMENT') {
      return { alreadyProcessed: true, payment, orderId: payment.order_id };
    }

    if (status === 'SUCCEEDED') {
      await updatePaymentStatusTx(client, payment.id, 'SUCCEEDED', event);
      await updateOrderStatusTx(client, payment.order_id, 'CONFIRMED');
      await updateOrderStatusFieldsTx(client, payment.order_id, { paymentStatus: 'PAID', orderStatus: 'CONFIRMED' });
      await insertOrderStatusHistoryTx(client, payment.order_id, 'CONFIRMED', 'Payment confirmed', {
        source: 'PAYMENT_GATEWAY',
      });
      await confirmReservationsForOrderTx(client, payment.order_id);

      // Coupon is only actually consumed here (plan §11) — checkout merely
      // validated it. ON CONFLICT DO NOTHING (see insertCouponUsageTx) makes
      // a repeat webhook delivery for the same order a safe no-op.
      if (order.coupon_id) {
        await insertCouponUsageTx(client, {
          couponId: order.coupon_id,
          userId: order.user_id,
          orderId: order.id,
        });
      }

      // Remove exactly the items this order paid for from the shopper's
      // cart — see clearOrderedItemsFromCartTx for why this can't be a
      // blanket "empty the cart" (Buy Now reuses this same confirm path).
      const cart = await findCartByOwnerTx(client, { userId: order.user_id });
      if (cart) await clearOrderedItemsFromCartTx(client, cart.id, payment.order_id);
    } else {
      await updatePaymentStatusTx(client, payment.id, 'FAILED', event);
      await updateOrderStatusTx(client, payment.order_id, 'PAYMENT_FAILED');
      await updateOrderStatusFieldsTx(client, payment.order_id, { paymentStatus: 'FAILED' });
      await insertOrderStatusHistoryTx(client, payment.order_id, 'PAYMENT_FAILED', 'Payment failed', {
        source: 'PAYMENT_GATEWAY',
      });
      // No retry-same-order flow exists yet, so hold no reservation hostage
      // waiting for one — release immediately rather than waiting for the
      // expiry sweep.
      await releaseReservationsForOrderTx(client, payment.order_id);
    }

    return { alreadyProcessed: false, payment, orderId: payment.order_id };
  });

  if (!result.alreadyProcessed) {
    const order = await findOrderById(result.orderId);
    if (status === 'SUCCEEDED') {
      await invalidateOrderProductPages(result.orderId);
      await enqueueMetaPurchase(result.orderId);
      await enqueueEmail(order.contact_email, 'ORDER_CONFIRMED', {
        orderId: order.id,
        contactName: order.contact_name,
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
      });
    } else {
      await enqueueEmail(order.contact_email, 'PAYMENT_FAILED', {
        contactName: order.contact_name,
        orderNumber: order.order_number,
      });
    }
  }

  return result;
}

async function invalidateOrderProductPages(orderId) {
  try {
    const items = await findOrderItems(orderId);
    const products = await findProductsByIds(items.map((i) => i.product_id));
    await invalidateProductsPagesBatch(products);
  } catch (err) {
    console.error('Page cache invalidation after payment confirm failed:', err);
  }
}

// Dev-only stand-in for "the customer completed payment on the gateway's
// page" (plan §11 stub scope) — constructs a properly signed payload via
// the same signPayload() a real provider's servers would use, then runs it
// through the exact same confirmPayment() the public webhook uses. Requires
// the order to belong to the caller so a guessed providerRef can't be used
// to confirm someone else's order. Only ever wired to the stub — once a
// real provider is configured this must never be reachable, or it'd be a
// way to fake a successful payment without actually paying.
export async function simulatePayment(userId, providerRef, outcome) {
  if (env.paymentProvider !== 'stub') {
    throw new AppError(404, 'Not found');
  }

  const payment = await findPaymentByProviderRef(providerRef);
  if (!payment) throw new NotFoundError('Unknown payment reference');

  const order = await findOrderById(payment.order_id);
  if (!order || order.user_id !== userId) throw new ForbiddenError('Not your order');

  const { body, headers } = paymentProvider.signPayload({ providerRef, status: outcome });
  return confirmPayment(body, headers);
}
