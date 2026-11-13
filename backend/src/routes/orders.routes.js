import { Router } from 'express';
import { list, get, stats, cancel } from '../controllers/orders.controller.js';
import {
  get as getReturnRequest,
  create as createReturnRequest,
  cancel as cancelReturnRequest,
} from '../controllers/orderReturns.controller.js';
import { requireCustomerAuth } from '../middleware/customerAuth.js';
import { uploadReturnMedia } from '../middleware/upload.js';

// Mounted at /api/v1/orders — "My Orders" (plan §12), always the caller's
// own orders only (loadOwnedOrder checks user_id, never trusts the id alone).
export const ordersRouter = Router();

ordersRouter.use(requireCustomerAuth);
ordersRouter.get('/', list);
// Must come before /:id or Express would match "stats" as the :id param.
ordersRouter.get('/stats', stats);
ordersRouter.get('/:id', get);
ordersRouter.post('/:id/cancel', cancel);
ordersRouter.get('/:id/return-request', getReturnRequest);
ordersRouter.post('/:id/return-request', uploadReturnMedia, createReturnRequest);
ordersRouter.post('/:id/return-request/cancel', cancelReturnRequest);
