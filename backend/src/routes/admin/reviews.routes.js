import { Router } from 'express';
import { list, approve, reject, resetToPending } from '../../controllers/adminReviews.controller.js';
import { requirePermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/reviews (plan §5 moderation queue).
export const adminReviewsRouter = Router();

adminReviewsRouter.use(requirePermission('reviews'));
adminReviewsRouter.get('/', list);
adminReviewsRouter.post('/:id/approve', approve);
adminReviewsRouter.post('/:id/reject', reject);
adminReviewsRouter.post('/:id/reset-to-pending', resetToPending);
