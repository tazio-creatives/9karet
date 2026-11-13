import { Router } from 'express';
import { login, logout, me } from '../controllers/adminAuth.controller.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { adminLoginRateLimiter } from '../middleware/rateLimit.js';

// Mounted at /api/v1/auth/admin — see app.js.
export const adminAuthRouter = Router();

adminAuthRouter.post('/login', adminLoginRateLimiter, login);
adminAuthRouter.post('/logout', requireAdminAuth, logout);
adminAuthRouter.get('/me', requireAdminAuth, me);
