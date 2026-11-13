import { Router } from 'express';
import { list, getBySlug } from '../controllers/collections.controller.js';

// Mounted at /api/v1/collections — public.
export const collectionsRouter = Router();

collectionsRouter.get('/', list);
collectionsRouter.get('/:slug', getBySlug);
