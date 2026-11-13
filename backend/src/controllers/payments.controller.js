import { simulatePaymentSchema } from '../validators/payments.validators.js';
import * as paymentService from '../services/paymentService.js';
import { findOrderById, findOrderItems, findOrderStatusHistory } from '../repositories/orders.repository.js';
import { toOrderDto } from '../utils/orderDto.js';

// Dev-only stand-in for the gateway's own payment page (plan §11 stub
// scope) — see paymentService.simulatePayment for why this still exercises
// the real signature-verification + idempotency path.
export async function simulate(req, res, next) {
  try {
    const { providerRef, outcome } = simulatePaymentSchema.parse(req.body);
    const result = await paymentService.simulatePayment(req.customer.id, providerRef, outcome);

    const order = await findOrderById(result.orderId);
    const [items, statusHistory] = await Promise.all([
      findOrderItems(order.id),
      findOrderStatusHistory(order.id),
    ]);
    res.json({ order: toOrderDto(order, items, statusHistory) });
  } catch (err) {
    next(err);
  }
}
