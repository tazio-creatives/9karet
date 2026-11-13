import { Router } from 'express';
import { me, updateMe, logout } from '../controllers/customers.controller.js';
import { requireCustomerAuth } from '../middleware/customerAuth.js';

export const customersRouter = Router();

customersRouter.get('/me', requireCustomerAuth, me);
customersRouter.patch('/me', requireCustomerAuth, updateMe);
customersRouter.post('/logout', requireCustomerAuth, logout);
