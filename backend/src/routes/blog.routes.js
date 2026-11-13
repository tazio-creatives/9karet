import { Router } from 'express';
import { listPublished, getPublished, listPublishedSlugs } from '../controllers/blog.controller.js';

// Mounted at /api/v1/blog — public, published posts only.
export const blogRouter = Router();

blogRouter.get('/', listPublished);
// Must come before /:slug.
blogRouter.get('/sitemap', listPublishedSlugs);
blogRouter.get('/:slug', getPublished);
