import { Router } from 'express';
import {
  list,
  get,
  summary,
  startProcessing,
  markReadyToShip,
  updateStatus,
  markRefunded,
  restock,
} from '../../controllers/adminOrders.controller.js';
import { get as getWorkOrder, recordPrint as recordWorkOrderPrint } from '../../controllers/adminWorkOrder.controller.js';
import { get as getInvoice, recordPrint as recordInvoicePrint } from '../../controllers/adminInvoice.controller.js';
import {
  get as getReturnRequest,
  updateStatus as updateReturnRequestStatus,
  createReversePickup,
  syncReversePickup,
  simulateReversePickup,
} from '../../controllers/adminReturns.controller.js';
import { requirePermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/orders — every order, not scoped to one customer.
export const adminOrdersRouter = Router();

adminOrdersRouter.use(requirePermission('orders'));
adminOrdersRouter.get('/', list);
// Must come before /:id — otherwise "summary" is parsed as an order id.
adminOrdersRouter.get('/summary', summary);
adminOrdersRouter.get('/:id', get);
adminOrdersRouter.post('/:id/start-processing', startProcessing);
adminOrdersRouter.post('/:id/mark-ready-to-ship', markReadyToShip);
adminOrdersRouter.patch('/:id/status', updateStatus);
adminOrdersRouter.post('/:id/mark-refunded', markRefunded);
adminOrdersRouter.post('/:id/restock', restock);
adminOrdersRouter.get('/:id/work-order', getWorkOrder);
adminOrdersRouter.post('/:id/work-order/print', recordWorkOrderPrint);
adminOrdersRouter.get('/:id/invoice', getInvoice);
adminOrdersRouter.post('/:id/invoice/print', recordInvoicePrint);
adminOrdersRouter.get('/:id/return-request', getReturnRequest);
adminOrdersRouter.patch('/:id/return-request', updateReturnRequestStatus);
adminOrdersRouter.post('/:id/return-request/reverse-pickup', createReversePickup);
adminOrdersRouter.post('/:id/return-request/reverse-pickup/sync', syncReversePickup);
adminOrdersRouter.post('/:id/return-request/reverse-pickup/simulate', simulateReversePickup);
