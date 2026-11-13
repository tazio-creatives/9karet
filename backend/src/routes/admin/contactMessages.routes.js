import { Router } from 'express';
import { list, update } from '../../controllers/contactMessages.controller.js';
import { requirePermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/contact-messages — the storefront Contact Us inbox.
export const adminContactMessagesRouter = Router();

adminContactMessagesRouter.use(requirePermission('messages'));
adminContactMessagesRouter.get('/', list);
adminContactMessagesRouter.patch('/:id', update);
