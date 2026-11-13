import { Router } from 'express';
import { list, get } from '../../controllers/adminCustomers.controller.js';
import { requirePermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/customers.
export const adminCustomersRouter = Router();

adminCustomersRouter.use(requirePermission('customers'));
adminCustomersRouter.get('/', list);
adminCustomersRouter.get('/:id', get);
