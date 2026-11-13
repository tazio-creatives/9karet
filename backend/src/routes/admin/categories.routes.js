import { Router } from 'express';
import {
  adminList,
  adminCreate,
  adminUpdate,
  adminDelete,
  adminUploadImage,
} from '../../controllers/categories.controller.js';
import { upload } from '../../middleware/upload.js';
import { requirePermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/categories — admin session already required by
// the parent router (see app.js).
export const adminCategoriesRouter = Router();

adminCategoriesRouter.use(requirePermission('categories'));
adminCategoriesRouter.get('/', adminList);
adminCategoriesRouter.post('/', adminCreate);
adminCategoriesRouter.post('/upload-image', upload.single('image'), adminUploadImage);
adminCategoriesRouter.patch('/:id', adminUpdate);
adminCategoriesRouter.delete('/:id', adminDelete);
