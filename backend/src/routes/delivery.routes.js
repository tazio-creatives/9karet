import { Router } from 'express';
import { checkPincode } from '../controllers/delivery.controller.js';
import { pincodeCheckRateLimiter } from '../middleware/rateLimit.js';

// Mounted at /api/v1/delivery — public, no session needed.
export const deliveryRouter = Router();

deliveryRouter.get('/pincode/:pincode', pincodeCheckRateLimiter, checkPincode);
