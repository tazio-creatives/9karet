import { Router } from 'express';
import { simulate } from '../controllers/payments.controller.js';
import { requireCustomerAuth } from '../middleware/customerAuth.js';

// Mounted at /api/v1/payments — the real webhook lives at paymentWebhook.routes.js
// (mounted separately, before express.json()); this router is the ordinary
// customer-authenticated JSON side of payments (currently just the dev
// "simulate" endpoint).
export const paymentsRouter = Router();

paymentsRouter.post('/simulate', requireCustomerAuth, simulate);
