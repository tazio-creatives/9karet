import { Router } from 'express';
import { list, create, update, remove } from '../controllers/addresses.controller.js';
import { requireCustomerAuth } from '../middleware/customerAuth.js';

// Mounted at /api/v1/addresses — addresses always belong to a logged-in
// user (no guest addresses in the schema), so every route requires auth.
export const addressesRouter = Router();

addressesRouter.use(requireCustomerAuth);
addressesRouter.get('/', list);
addressesRouter.post('/', create);
addressesRouter.patch('/:id', update);
addressesRouter.delete('/:id', remove);
