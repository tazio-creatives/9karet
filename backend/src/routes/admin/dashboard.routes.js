import { Router } from 'express';
import { getStats } from '../../controllers/adminDashboard.controller.js';
import { requirePermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/dashboard — aggregate metrics for the admin home screen.
export const adminDashboardRouter = Router();

adminDashboardRouter.use(requirePermission('dashboard'));
adminDashboardRouter.get('/stats', getStats);
