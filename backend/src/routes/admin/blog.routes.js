import { Router } from 'express';
import {
  adminList,
  adminGet,
  adminCreate,
  adminUpdate,
  adminDelete,
  adminUploadImage,
} from '../../controllers/blog.controller.js';
import { upload } from '../../middleware/upload.js';
import { requirePermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/blog.
export const adminBlogRouter = Router();

adminBlogRouter.use(requirePermission('blog'));
adminBlogRouter.get('/', adminList);
adminBlogRouter.post('/', adminCreate);
// Must come before /:id.
adminBlogRouter.post('/upload-image', upload.single('image'), adminUploadImage);
adminBlogRouter.get('/:id', adminGet);
adminBlogRouter.patch('/:id', adminUpdate);
adminBlogRouter.delete('/:id', adminDelete);
