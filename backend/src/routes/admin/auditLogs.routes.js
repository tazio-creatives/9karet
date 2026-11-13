import { Router } from 'express';
import { list } from '../../controllers/adminAuditLogs.controller.js';
import { requirePermission } from '../../middleware/adminAuth.js';

export const adminAuditLogsRouter = Router();

adminAuditLogsRouter.use(requirePermission('audit-logs'));
adminAuditLogsRouter.get('/', list);
