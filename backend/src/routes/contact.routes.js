import { Router } from 'express';
import { create } from '../controllers/contactMessages.controller.js';
import { contactRateLimiter } from '../middleware/rateLimit.js';

// Mounted at /api/v1/contact — public, no session needed.
export const contactRouter = Router();

contactRouter.post('/', contactRateLimiter, create);
