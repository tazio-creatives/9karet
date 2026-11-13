import { Router } from 'express';
import { checkout } from '../controllers/checkout.controller.js';
import { requireCustomerAuth } from '../middleware/customerAuth.js';

// Mounted at /api/v1/checkout — orders always belong to a logged-in user.
export const checkoutRouter = Router();

checkoutRouter.post('/', requireCustomerAuth, checkout);
