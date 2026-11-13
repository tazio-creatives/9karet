import { Router } from 'express';
import { requireCustomerAuth } from '../middleware/customerAuth.js';
import { apply } from '../controllers/coupons.controller.js';

// Mounted under the customer session router (plan §6) — per-user usage
// limits mean this can never be answered for an anonymous shopper.
export const couponsRouter = Router();

couponsRouter.post('/apply', requireCustomerAuth, apply);
