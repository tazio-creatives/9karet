import { Router } from 'express';
import { list, create, update } from '../../controllers/stoneTypes.controller.js';
import { requireAnyPermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/stone-types. Open to product managers as well as
// pricing — the product form picks stones from this list and can add a new
// type inline, and stone discount rules are scoped by it.
export const adminStoneTypesRouter = Router();

adminStoneTypesRouter.use(requireAnyPermission(['products', 'pricing']));
adminStoneTypesRouter.get('/', list);
adminStoneTypesRouter.post('/', create);
adminStoneTypesRouter.put('/:id', update);
