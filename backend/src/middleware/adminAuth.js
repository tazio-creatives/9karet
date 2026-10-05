import { getAdminById } from '../services/adminAuthService.js';
import { UnauthorizedError, ForbiddenError } from '../utils/AppError.js';

// Attaches req.admin when a valid admin session exists; does not itself
// reject the request (use requireAdminAuth for that). Runs on every request
// so downstream handlers can optionally read req.admin.
export async function loadAdmin(req, res, next) {
  try {
    const adminId = req.session?.adminId;
    req.admin = adminId ? await getAdminById(adminId) : null;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdminAuth(req, res, next) {
  if (!req.admin) return next(new UnauthorizedError('Admin authentication required'));
  next();
}

// Enforces role membership; SUPER_ADMIN (permissions: ["*"]) always passes.
// Finer-grained per-permission checks can build on admin_roles.permissions
// later — this is the coarse mechanism the plan's admin modules need first.
export function requireRole(...allowedRoleNames) {
  return (req, res, next) => {
    if (!req.admin) return next(new UnauthorizedError('Admin authentication required'));
    const { name, permissions } = req.admin.role;
    if (permissions?.includes('*') || allowedRoleNames.includes(name)) return next();
    next(new ForbiddenError('Insufficient role'));
  };
}

// Module-level access check (ADMIN_PERMISSION_MODULES) — mounted per-router
// the same way requireRole('SUPER_ADMIN') gates admin-users, so a role like
// "Order Manager" (permissions: ["orders"]) only ever reaches the Orders
// routes and gets a clean 403 everywhere else. SUPER_ADMIN's '*' still
// passes everything.
// Any one of several modules grants access (e.g. "First 50 Products"
// ordering is open to product or homepage managers).
export function requireAnyPermission(moduleNames) {
  return (req, res, next) => {
    if (!req.admin) return next(new UnauthorizedError('Admin authentication required'));
    const { permissions } = req.admin.role;
    if (permissions?.includes('*') || moduleNames.some((m) => permissions?.includes(m))) return next();
    next(new ForbiddenError('Insufficient permissions'));
  };
}

export function requirePermission(moduleName) {
  return (req, res, next) => {
    if (!req.admin) return next(new UnauthorizedError('Admin authentication required'));
    const { permissions } = req.admin.role;
    if (permissions?.includes('*') || permissions?.includes(moduleName)) return next();
    next(new ForbiddenError('Insufficient permissions'));
  };
}
