import { updateCustomerProfileSchema } from '../validators/customers.validators.js';
import { updateUserProfile } from '../repositories/users.repository.js';
import { env } from '../config/env.js';

export function me(req, res) {
  res.json({ customer: req.customer });
}

// Mirrors adminAuth.controller.js's logout — destroy the session server-side
// (not just clear the cookie) so a stolen/replayed cookie can't be reused.
export function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(env.customerSessionCookieName);
    res.status(204).end();
  });
}

export async function updateMe(req, res, next) {
  try {
    const { fullName, email } = updateCustomerProfileSchema.parse(req.body);
    const user = await updateUserProfile(req.customer.id, { fullName, email });
    res.json({
      customer: {
        id: user.id,
        mobileNumber: user.mobile_number,
        fullName: user.full_name,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
}
