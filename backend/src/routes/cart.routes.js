import { Router } from 'express';
import { get, addItem, updateItem, removeItem } from '../controllers/cart.controller.js';

// Mounted at /api/v1/cart — under customerRouter (customerSession +
// loadCustomer + CSRF, no requireCustomerAuth) so it works for guests too.
export const cartRouter = Router();

cartRouter.get('/', get);
cartRouter.post('/items', addItem);
cartRouter.patch('/items/:variantId', updateItem);
cartRouter.delete('/items/:variantId', removeItem);
