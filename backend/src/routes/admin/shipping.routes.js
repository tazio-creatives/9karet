import { Router } from 'express';
import {
  listProviders,
  createShipment,
  cancelShipment,
  syncTracking,
  simulateTracking,
  addTrackingEvent,
} from '../../controllers/adminShipping.controller.js';
import { requirePermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/shipping — order-scoped actions, gated by the
// same 'orders' module as adminOrdersRouter (they're always reached from
// the order detail page, never a standalone "Shipping" nav item).
export const adminShippingRouter = Router();

adminShippingRouter.use(requirePermission('orders'));
adminShippingRouter.get('/providers', listProviders);
adminShippingRouter.post('/orders/:id/create-shipment', createShipment);
adminShippingRouter.post('/orders/:id/cancel-shipment', cancelShipment);
adminShippingRouter.post('/orders/:id/sync-tracking', syncTracking);
adminShippingRouter.post('/orders/:id/simulate-tracking', simulateTracking);
adminShippingRouter.post('/orders/:id/tracking-events', addTrackingEvent);
