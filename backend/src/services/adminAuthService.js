import bcrypt from 'bcrypt';
import { findAdminByEmail, findAdminById } from '../repositories/adminUsers.repository.js';
import { UnauthorizedError } from '../utils/AppError.js';

// Precomputed at module load so failed-login timing doesn't reveal whether
// the email exists (bcrypt.compare against a missing hash would short-circuit).
const DUMMY_HASH = await bcrypt.hash('dummy-password-for-timing-safety', 12);

function toPublicAdmin(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: { id: row.role_id, name: row.role_name, permissions: row.permissions },
  };
}

export async function verifyAdminCredentials(email, password) {
  const admin = await findAdminByEmail(email);
  const passwordMatches = await bcrypt.compare(password, admin?.password_hash ?? DUMMY_HASH);

  if (!admin || !admin.is_active || !passwordMatches) {
    throw new UnauthorizedError('Invalid email or password');
  }

  return toPublicAdmin(admin);
}

export async function getAdminById(id) {
  const admin = await findAdminById(id);
  if (!admin || !admin.is_active) return null;
  return toPublicAdmin(admin);
}
