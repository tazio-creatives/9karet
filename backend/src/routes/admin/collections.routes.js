import { Router } from 'express';
import {
  adminList,
  adminCreate,
  adminUpdate,
  adminDelete,
} from '../../controllers/collections.controller.js';
import { requirePermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/collections.
export const adminCollectionsRouter = Router();

adminCollectionsRouter.use(requirePermission('collections'));
adminCollectionsRouter.get('/', adminList);
adminCollectionsRouter.post('/', adminCreate);
adminCollectionsRouter.patch('/:id', adminUpdate);
adminCollectionsRouter.delete('/:id', adminDelete);
