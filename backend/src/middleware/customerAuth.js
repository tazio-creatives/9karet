import { findUserById } from '../repositories/users.repository.js';
import { UnauthorizedError } from '../utils/AppError.js';

function toPublicCustomer(row) {
  return { id: row.id, mobileNumber: row.mobile_number, fullName: row.full_name, email: row.email };
}

// Mirrors loadAdmin — attaches req.customer when a valid session exists,
// doesn't reject by itself (guest browsing must keep working — plan §17).
export async function loadCustomer(req, res, next) {
  try {
    const customerId = req.session?.customerId;
    const user = customerId ? await findUserById(customerId) : null;
    req.customer = user ? toPublicCustomer(user) : null;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireCustomerAuth(req, res, next) {
  if (!req.customer) return next(new UnauthorizedError('Login required'));
  next();
}
