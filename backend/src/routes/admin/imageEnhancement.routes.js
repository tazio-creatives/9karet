import { Router } from 'express';
import { enhance } from '../../controllers/imageEnhancement.controller.js';
import { uploadEnhanceImage } from '../../middleware/upload.js';
import { requirePermission } from '../../middleware/adminAuth.js';

export const adminImageEnhancementRouter = Router();

adminImageEnhancementRouter.use(requirePermission('products'));
adminImageEnhancementRouter.post('/', uploadEnhanceImage.single('image'), enhance);
