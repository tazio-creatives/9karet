import { Router } from 'express';
import { list, getBySlug, getRelated, getMostLoved, pricePreview } from '../controllers/products.controller.js';
import { list as listReviews } from '../controllers/reviews.controller.js';

// Mounted at /api/v1/products — public, guest browsing must work (plan §17).
export const productsRouter = Router();

productsRouter.get('/', list);
productsRouter.get('/:slug/related', getRelated);
productsRouter.get('/:slug/most-loved', getMostLoved);
productsRouter.get('/:slug', getBySlug);
// Approved reviews only (plan §11a) — public, no session needed. Submitting
// a review (POST, same path) needs customer auth and is handled by
// productReviews.routes.js under the customer session router instead.
productsRouter.get('/:id/reviews', listReviews);
// Live price for a Gold Colour/Size selection — id-based (the PDP
// already has product.id after loading by slug), same pattern as reviews.
productsRouter.get('/:id/price-preview', pricePreview);
