import { Router } from 'express';
import { get, addItem, removeItem } from '../controllers/wishlist.controller.js';

// Mounted at /api/v1/wishlist — same guest/customer pattern as cart.routes.js.
export const wishlistRouter = Router();

wishlistRouter.get('/', get);
wishlistRouter.post('/items', addItem);
wishlistRouter.delete('/items/:productId', removeItem);
