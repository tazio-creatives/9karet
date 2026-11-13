import bcrypt from 'bcrypt';
import {
  insertAdminUser,
  updateAdminUser as updateAdminUserRow,
  deleteAdminUser as deleteAdminUserRow,
  findAdminById,
  findAdminByEmail,
} from '../repositories/adminUsers.repository.js';
import {
  findRoleById,
  findRoleByName,
  insertRole,
  updateRole as updateRoleRow,
  countAdminUsersByRoleId,
} from '../repositories/adminRoles.repository.js';
import { AppError, NotFoundError } from '../utils/AppError.js';

const BCRYPT_ROUNDS = 12;

// SUPER_ADMIN is the one role every other permission-gated route trusts
// unconditionally (requireRole/requirePermission both special-case its '*'
// wildcard) — renaming it or narrowing its permissions would silently
// break that assumption everywhere else, so it's protected from both here
// rather than relying on every future caller to remember not to touch it.
const PROTECTED_ROLE_NAME = 'SUPER_ADMIN';

export async function createRole({ name, permissions }) {
  if (name.toUpperCase() === PROTECTED_ROLE_NAME) {
    throw new AppError(400, `"${PROTECTED_ROLE_NAME}" is reserved`);
  }
  const existing = await findRoleByName(name);
  if (existing) throw new AppError(409, 'A role with this name already exists');
  return insertRole({ name, permissions });
}

export async function updateRole(id, { name, permissions }) {
  const existing = await findRoleById(id);
  if (!existing) throw new NotFoundError('Role not found');
  if (existing.name === PROTECTED_ROLE_NAME) {
    throw new AppError(400, `"${PROTECTED_ROLE_NAME}" cannot be modified`);
  }
  if (name && name.toUpperCase() === PROTECTED_ROLE_NAME) {
    throw new AppError(400, `"${PROTECTED_ROLE_NAME}" is reserved`);
  }
  if (name && name !== existing.name) {
    const clash = await findRoleByName(name);
    if (clash) throw new AppError(409, 'A role with this name already exists');
  }
  return updateRoleRow(id, { name, permissions });
}

export async function createAdminUser({ email, password, fullName, roleId }) {
  const existing = await findAdminByEmail(email);
  if (existing) throw new AppError(409, 'An admin with this email already exists');

  const role = await findRoleById(roleId);
  if (!role) throw new AppError(400, 'Unknown role');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return insertAdminUser({ email, passwordHash, fullName, roleId });
}

// actingAdminId: the admin making the request — an admin can never
// deactivate or demote their own account (plan §8 SEC concern: prevents a
// single mistaken/self-serving request from locking every admin out).
export async function updateAdminUser(id, actingAdminId, { fullName, roleId, isActive, password }) {
  const existing = await findAdminById(id);
  if (!existing) throw new NotFoundError('Admin user not found');

  if (id === actingAdminId && isActive === false) {
    throw new AppError(400, 'You cannot deactivate your own account');
  }
  // The comment above already claimed this was blocked, but roleId was
  // never actually checked — a real lockout risk now that non-SUPER_ADMIN
  // roles exist (a SUPER_ADMIN could accidentally demote themselves out of
  // admin-user management with no one left able to reverse it).
  if (id === actingAdminId && roleId !== undefined && roleId !== existing.role_id) {
    throw new AppError(400, 'You cannot change your own role');
  }

  const fields = {};
  if (fullName !== undefined) fields.fullName = fullName;
  if (isActive !== undefined) fields.isActive = isActive;
  if (roleId !== undefined) {
    const role = await findRoleById(roleId);
    if (!role) throw new AppError(400, 'Unknown role');
    fields.roleId = roleId;
  }
  if (password) {
    fields.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  return updateAdminUserRow(id, fields);
}

// actingAdminId: same self-protection reasoning as updateAdminUser — an
// admin can never delete their own account. Also blocks removing the last
// SUPER_ADMIN specifically (not just "the last admin overall"), since
// that's the one role every custom role's permissions are trusted against —
// losing it entirely would mean no one left who can manage admin users or
// roles at all, with no way back in.
export async function deleteAdminUser(id, actingAdminId) {
  const existing = await findAdminById(id);
  if (!existing) throw new NotFoundError('Admin user not found');

  if (id === actingAdminId) {
    throw new AppError(400, 'You cannot delete your own account');
  }

  if (existing.permissions?.includes('*')) {
    const remaining = await countAdminUsersByRoleId(existing.role_id);
    if (remaining <= 1) {
      throw new AppError(400, 'Cannot delete the last Super Admin');
    }
  }

  await deleteAdminUserRow(id);
}
