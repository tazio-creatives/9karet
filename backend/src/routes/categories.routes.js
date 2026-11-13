import { Router } from 'express';
import { list, getBySlug, getFilterCounts } from '../controllers/categories.controller.js';

// Mounted at /api/v1/categories — public, guest browsing must work (plan §17).
export const categoriesRouter = Router();

categoriesRouter.get('/', list);
categoriesRouter.get('/:slug/counts', getFilterCounts);
categoriesRouter.get('/:slug', getBySlug);
