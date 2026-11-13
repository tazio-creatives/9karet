import { query } from '../config/db.js';

export async function findUserByMobile(mobileNumber) {
  const { rows } = await query('SELECT * FROM users WHERE mobile_number = $1', [mobileNumber]);
  return rows[0] ?? null;
}

export async function findUserById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function createUserByMobile(mobileNumber) {
  const { rows } = await query('INSERT INTO users (mobile_number) VALUES ($1) RETURNING *', [
    mobileNumber,
  ]);
  return rows[0];
}

export async function updateUserProfile(id, { fullName, email }) {
  const { rows } = await query(
    `UPDATE users SET full_name = COALESCE($2, full_name), email = COALESCE($3, email),
            updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, fullName, email],
  );
  return rows[0];
}

export async function updateUserMobile(id, mobileNumber) {
  const { rows } = await query(
    `UPDATE users SET mobile_number = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, mobileNumber],
  );
  return rows[0];
}

// Admin customer directory (plan §5 /customers, /customers/:id).
export async function listUsers({ search, page = 1, limit = 20 } = {}) {
  const clauses = [];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    clauses.push(
      `(mobile_number ILIKE $${params.length} OR full_name ILIKE $${params.length} OR email ILIKE $${params.length})`,
    );
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const listParams = [...params, limit, offset];

  const { rows } = await query(
    `SELECT * FROM users ${where}
     ORDER BY created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  const {
    rows: [{ count }],
  } = await query(`SELECT COUNT(*)::int AS count FROM users ${where}`, params);

  return { items: rows, total: count };
}
