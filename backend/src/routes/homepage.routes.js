import { Router } from 'express';
import { get } from '../controllers/homepage.controller.js';

// Mounted at /api/v1/homepage — public.
export const homepageRouter = Router();

homepageRouter.get('/', get);
