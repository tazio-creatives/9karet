import { Router } from 'express';
import { search } from '../controllers/search.controller.js';

// Mounted at /api/v1/search — public.
export const searchRouter = Router();

searchRouter.get('/', search);
