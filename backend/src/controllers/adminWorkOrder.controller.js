import {
  findOrderById,
  findOrderItems,
  findOrderStatusHistoryForAdmin,
  hasOrderStatusHistoryEntry,
} from '../repositories/orders.repository.js';
import { findWorkOrderPrints, insertWorkOrderPrint } from '../repositories/workOrderPrints.repository.js';
import { toOrderDto } from '../utils/orderDto.js';
import { NotFoundError, AppError } from '../utils/AppError.js';

// Enabled once the order has reached Processing at least once — checked via
// order_status_history rather than the order's *current* order_status, so a
// work order printed while Processing stays viewable/reprintable even if the
// order later moves on to an exception status (e.g. Cancelled after
// processing had already started). An order cancelled straight from
// Confirmed (never processed) correctly stays gated out.
async function assertProcessingReached(order) {
  const reached = await hasOrderStatusHistoryEntry(order.id, 'PROCESSING');
  if (!reached) {
    throw new AppError(400, 'Work order is available once the order has started processing');
  }
}

export async function get(req, res, next) {
  try {
    const order = await findOrderById(req.params.id);
    if (!order) throw new NotFoundError('Order not found');
    await assertProcessingReached(order);

    const [items, prints, history] = await Promise.all([
      findOrderItems(order.id),
      findWorkOrderPrints(order.id),
      findOrderStatusHistoryForAdmin(order.id),
    ]);
    const processingStartedAt = history.find((h) => h.status === 'PROCESSING')?.created_at ?? null;

    res.json({
      order: toOrderDto(order, items, [], {}, { forAdmin: true }),
      processingStartedAt,
      printCount: prints.length,
      lastPrintedAt: prints.length ? prints[prints.length - 1].printed_at : null,
    });
  } catch (err) {
    next(err);
  }
}

export async function recordPrint(req, res, next) {
  try {
    const order = await findOrderById(req.params.id);
    if (!order) throw new NotFoundError('Order not found');
    await assertProcessingReached(order);

    const priorPrints = await findWorkOrderPrints(order.id);
    const print = await insertWorkOrderPrint(order.id, req.admin.id);

    res.json({
      printNumber: priorPrints.length + 1,
      isReprint: priorPrints.length > 0,
      printedAt: print.printed_at,
    });
  } catch (err) {
    next(err);
  }
}
