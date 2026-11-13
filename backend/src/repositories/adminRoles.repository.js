import { query } from '../config/db.js';

export async function listRoles() {
  const { rows } = await query('SELECT * FROM admin_roles ORDER BY name');
  return rows;
}

export async function findRoleById(id) {
  const { rows } = await query('SELECT * FROM admin_roles WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function findRoleByName(name) {
  const { rows } = await query('SELECT * FROM admin_roles WHERE name = $1', [name]);
  return rows[0] ?? null;
}

export async function insertRole({ name, permissions }) {
  const { rows } = await query(
    'INSERT INTO admin_roles (name, permissions) VALUES ($1, $2::jsonb) RETURNING *',
    [name, JSON.stringify(permissions)],
  );
  return rows[0];
}

export async function updateRole(id, { name, permissions }) {
  const { rows } = await query(
    `UPDATE admin_roles SET name = COALESCE($2, name), permissions = COALESCE($3::jsonb, permissions)
     WHERE id = $1 RETURNING *`,
    [id, name ?? null, permissions !== undefined ? JSON.stringify(permissions) : null],
  );
  return rows[0] ?? null;
}

// How many admin_users currently reference this role — used to block
// deleting/repurposing a role that's still in use.
export async function countAdminUsersByRoleId(roleId) {
  const {
    rows: [{ count }],
  } = await query('SELECT COUNT(*)::int AS count FROM admin_users WHERE role_id = $1', [roleId]);
  return count;
}
