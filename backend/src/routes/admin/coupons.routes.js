import { Router } from 'express';
import { list, get, create, update } from '../../controllers/adminCoupons.controller.js';
import { requirePermission } from '../../middleware/adminAuth.js';

export const adminCouponsRouter = Router();

adminCouponsRouter.use(requirePermission('coupons'));
adminCouponsRouter.get('/', list);
adminCouponsRouter.get('/:id', get);
adminCouponsRouter.post('/', create);
adminCouponsRouter.patch('/:id', update);
