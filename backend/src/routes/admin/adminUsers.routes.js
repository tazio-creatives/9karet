import { Router } from 'express';
import { requireRole } from '../../middleware/adminAuth.js';
import { list, roles, create, update, remove, createRole, updateRole } from '../../controllers/adminUsers.controller.js';

// Managing who else has admin access — and what roles exist at all — is the
// most sensitive admin surface in the app (plan §8 SEC) — restricted to
// SUPER_ADMIN regardless of what other roles get added later.
export const adminUsersRouter = Router();

adminUsersRouter.use(requireRole('SUPER_ADMIN'));
adminUsersRouter.get('/', list);
adminUsersRouter.get('/roles', roles);
adminUsersRouter.post('/roles', createRole);
adminUsersRouter.patch('/roles/:id', updateRole);
adminUsersRouter.post('/', create);
adminUsersRouter.patch('/:id', update);
adminUsersRouter.delete('/:id', remove);
