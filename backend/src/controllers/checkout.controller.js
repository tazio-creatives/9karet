import { checkoutSchema } from '../validators/checkout.validators.js';
import * as checkoutService from '../services/checkoutService.js';
import * as paymentService from '../services/paymentService.js';
import { findOrderItems, findOrderStatusHistory, saveOrderMetaAttribution } from '../repositories/orders.repository.js';
import { toOrderDto } from '../utils/orderDto.js';

export async function checkout(req, res, next) {
  try {
    const input = checkoutSchema.parse(req.body);
    const order = await checkoutService.createOrder({ userId: req.customer.id, ...input });
    // Browser identifiers for the server-side Meta Purchase event sent once
    // payment is confirmed. Best effort: tracking must never fail a checkout.
    saveOrderMetaAttribution(order.id, {
      fbp: req.cookies?._fbp ?? null,
      fbc: req.cookies?._fbc ?? null,
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      sourceUrl: req.get('referer') ?? null,
    }).catch((err) => console.error('[meta-capi] attribution not saved', err.message));
    // Payment intent creation is deliberately outside the order/reservation
    // transaction (plan §11) — it's an external call, not DB work.
    const payment = await paymentService.createPaymentIntent(order);
    const [items, statusHistory] = await Promise.all([
      findOrderItems(order.id),
      findOrderStatusHistory(order.id),
    ]);
    res.status(201).json({
      order: toOrderDto(order, items, statusHistory),
      payment: {
        provider: payment.provider,
        providerRef: payment.provider_ref,
        paymentSessionId: payment.paymentSessionId ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}
