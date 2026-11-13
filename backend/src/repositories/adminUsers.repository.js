import { query } from '../config/db.js';

export async function findAdminByEmail(email) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.password_hash, u.full_name, u.is_active,
            r.id AS role_id, r.name AS role_name, r.permissions
     FROM admin_users u
     JOIN admin_roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findAdminById(id) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.is_active,
            r.id AS role_id, r.name AS role_name, r.permissions
     FROM admin_users u
     JOIN admin_roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listAdminUsers({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.is_active, u.created_at,
            r.id AS role_id, r.name AS role_name, r.permissions
     FROM admin_users u
     JOIN admin_roles r ON r.id = u.role_id
     ORDER BY u.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const {
    rows: [{ count }],
  } = await query('SELECT COUNT(*)::int AS count FROM admin_users');
  return { items: rows, total: count };
}

export async function insertAdminUser({ email, passwordHash, fullName, roleId }) {
  const { rows: [row] } = await query(
    `INSERT INTO admin_users (email, password_hash, full_name, role_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [email, passwordHash, fullName, roleId],
  );
  return findAdminById(row.id);
}

const ADMIN_USER_FIELD_MAP = {
  fullName: 'full_name',
  roleId: 'role_id',
  isActive: 'is_active',
  passwordHash: 'password_hash',
};

export async function updateAdminUser(id, fields) {
  const values = [id];
  const setClauses = [];
  for (const [key, column] of Object.entries(ADMIN_USER_FIELD_MAP)) {
    if (Object.hasOwn(fields, key)) {
      values.push(fields[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }
  if (setClauses.length === 0) return findAdminById(id);

  setClauses.push('updated_at = now()');
  await query(`UPDATE admin_users SET ${setClauses.join(', ')} WHERE id = $1`, values);
  return findAdminById(id);
}

// Every actor_admin_user_id / admin_user_id FK pointing at this row is
// ON DELETE SET NULL (audit_logs, order_status_history, invoices,
// work_order_prints, return_requests) — their history rows survive with the
// actor link cleared, never blocked or cascaded away.
export async function deleteAdminUser(id) {
  await query('DELETE FROM admin_users WHERE id = $1', [id]);
}
