import { Router } from 'express';
import {
  list,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  uploadImage,
  uploadVideo,
} from '../../controllers/adminHomepage.controller.js';
import { upload, uploadHomepageVideo } from '../../middleware/upload.js';
import { requirePermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/homepage (plan §5/§16).
export const adminHomepageRouter = Router();

adminHomepageRouter.use(requirePermission('homepage'));
adminHomepageRouter.get('/', list);
adminHomepageRouter.post('/upload-image', upload.single('image'), uploadImage);
adminHomepageRouter.post('/upload-video', uploadHomepageVideo, uploadVideo);
adminHomepageRouter.post('/sections', createSection);
adminHomepageRouter.patch('/sections/reorder', reorderSections);
adminHomepageRouter.patch('/sections/:id', updateSection);
adminHomepageRouter.delete('/sections/:id', deleteSection);
adminHomepageRouter.post('/sections/:id/items', createItem);
adminHomepageRouter.patch('/sections/:id/items/reorder', reorderItems);
adminHomepageRouter.patch('/items/:id', updateItem);
adminHomepageRouter.delete('/items/:id', deleteItem);
