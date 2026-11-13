import crypto from 'node:crypto';
import { env, isProduction } from '../config/env.js';

// Plain random id, not a signed session — just what Phase 9's guest carts/
// wishlist will key rows off (plan §11/§27). Issued to every visitor,
// logged in or not.
export function ensureGuestCartSession(req, res, next) {
  let cartSessionId = req.cookies?.[env.guestCartSessionCookieName];

  if (!cartSessionId) {
    cartSessionId = crypto.randomUUID();
    res.cookie(env.guestCartSessionCookieName, cartSessionId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: env.guestCartSessionMaxAgeDays * 24 * 60 * 60 * 1000,
    });
  }

  req.cartSessionId = cartSessionId;
  next();
}
