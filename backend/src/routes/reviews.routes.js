import { Router } from 'express';
import { update } from '../controllers/reviews.controller.js';
import { requireCustomerAuth } from '../middleware/customerAuth.js';
import { uploadReviewImages } from '../middleware/upload.js';

// Mounted at /reviews (app.js) — editing is by review id directly, not
// product-scoped like productReviews.routes.js's create endpoint.
export const reviewsRouter = Router();

reviewsRouter.patch('/:id', requireCustomerAuth, uploadReviewImages, update);
