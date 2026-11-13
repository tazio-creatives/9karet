import { Router } from 'express';
import { create } from '../controllers/reviews.controller.js';
import { requireCustomerAuth } from '../middleware/customerAuth.js';
import { uploadReviewImages } from '../middleware/upload.js';

// mergeParams so :id from the parent mount path (/products/:id/reviews,
// see app.js) is visible here as req.params.id.
export const productReviewsRouter = Router({ mergeParams: true });

productReviewsRouter.post('/', requireCustomerAuth, uploadReviewImages, create);
