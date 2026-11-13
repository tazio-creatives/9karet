import { ForbiddenError } from '../utils/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// SameSite=Lax cookies already block cross-site state-changing requests in
// modern browsers; this header check is the defense-in-depth layer for a
// same-site SPA + API (see plan §8). Webhook routes are exempt — they carry
// their own signature verification instead and don't send this header.
export function requireCsrfHeader(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.path.endsWith('/webhook')) return next();

  if (req.get('X-Requested-With') !== '9karet') {
    return next(new ForbiddenError('Missing CSRF header'));
  }
  next();
}
