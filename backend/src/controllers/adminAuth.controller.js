import { adminLoginSchema } from '../validators/adminAuth.validators.js';
import { verifyAdminCredentials } from '../services/adminAuthService.js';
import { env } from '../config/env.js';

export async function login(req, res, next) {
  try {
    const { email, password } = adminLoginSchema.parse(req.body);
    const admin = await verifyAdminCredentials(email, password);

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.adminId = admin.id;
      res.json({ admin });
    });
  } catch (err) {
    next(err);
  }
}

export function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(env.adminSessionCookieName);
    res.status(204).end();
  });
}

export function me(req, res) {
  res.json({ admin: req.admin });
}
