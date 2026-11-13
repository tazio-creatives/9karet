import { ZodError } from 'zod';
import multer from 'multer';
import { isProduction } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: { message: err.message } });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        fields: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
    });
  }

  // Postgres unique_violation — surface as a 409 rather than a generic 500.
  if (err.code === '23505') {
    return res.status(409).json({ error: { message: 'Already exists' } });
  }

  // Postgres foreign_key_violation (23503) and restrict_violation (23001) —
  // ON DELETE RESTRICT constraints raise the latter, not the former, e.g.
  // deleting a category still assigned to products, or a product still
  // referenced by order_items.
  if (err.code === '23503' || err.code === '23001') {
    return res.status(409).json({ error: { message: 'Still referenced by other records' } });
  }

  const status = err.status ?? 500;
  res.status(status).json({
    error: {
      message: status === 500 && isProduction ? 'Internal server error' : err.message,
    },
  });

  if (status === 500) {
    console.error(err);
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Not found: ${req.method} ${req.originalUrl}` } });
}
