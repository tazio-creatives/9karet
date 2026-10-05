import { Router } from 'express';
import { get, searchProducts, save, reset } from '../../controllers/adminDisplayOrder.controller.js';
import { requireAnyPermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/display-order, outside the shared admin router's
// generic audit middleware — save/reset write their own richer audit entry
// (previous + new order).
export const adminDisplayOrderRouter = Router();

adminDisplayOrderRouter.use(requireAnyPermission(['products', 'homepage']));

adminDisplayOrderRouter.get('/:placementType/:placementId', get);
adminDisplayOrderRouter.get('/:placementType/:placementId/products', searchProducts);
adminDisplayOrderRouter.put('/:placementType/:placementId', save);
adminDisplayOrderRouter.delete('/:placementType/:placementId', reset);
