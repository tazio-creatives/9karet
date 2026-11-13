import { findOrderById, findOrderItems } from '../repositories/orders.repository.js';
import {
  assignInvoiceNumberIfNeeded,
  findInvoicePrints,
  insertInvoicePrint,
} from '../repositories/invoices.repository.js';
import { toOrderDto } from '../utils/orderDto.js';
import { NotFoundError, AppError } from '../utils/AppError.js';

// A tax invoice only makes sense once payment has actually succeeded —
// order_status is null until then, same gate the rest of the order-status
// system already uses for "has this order really been paid for".
async function assertPaid(order) {
  if (order.payment_status !== 'PAID') {
    throw new AppError(400, 'Invoice is available once payment is confirmed');
  }
}

export async function get(req, res, next) {
  try {
    const order = await findOrderById(req.params.id);
    if (!order) throw new NotFoundError('Order not found');
    await assertPaid(order);

    // Assigned on first view, not at payment time — matches the plan's
    // "generate on demand" spirit and keeps invoice numbers gap-free (an
    // order that's paid but whose invoice is never opened never consumes
    // a number).
    const { invoiceNumber, invoiceGeneratedAt } = await assignInvoiceNumberIfNeeded(order.id);

    const [items, prints] = await Promise.all([findOrderItems(order.id), findInvoicePrints(order.id)]);

    res.json({
      order: toOrderDto(order, items, [], {}, { forAdmin: true }),
      invoiceNumber,
      invoiceGeneratedAt,
      printCount: prints.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function recordPrint(req, res, next) {
  try {
    const order = await findOrderById(req.params.id);
    if (!order) throw new NotFoundError('Order not found');
    await assertPaid(order);

    const priorPrints = await findInvoicePrints(order.id);
    const print = await insertInvoicePrint(order.id, req.admin.id);

    res.json({
      printNumber: priorPrints.length + 1,
      isReprint: priorPrints.length > 0,
      printedAt: print.printed_at,
    });
  } catch (err) {
    next(err);
  }
}
