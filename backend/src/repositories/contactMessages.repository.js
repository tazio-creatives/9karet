import { query } from '../config/db.js';

export async function insertContactMessage({ name, email, phone, orderNumber, message, ipAddress, userAgent }) {
  const { rows } = await query(
    `INSERT INTO contact_messages (name, email, phone, order_number, message, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name, email, phone ?? null, orderNumber ?? null, message, ipAddress ?? null, userAgent ?? null],
  );
  return rows[0];
}

export async function findContactMessageById(id) {
  const { rows } = await query('SELECT * FROM contact_messages WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Admin inbox list — optional status filter and a free-text search across
// the sender's name/email/phone, the order number and the message body.
export async function findContactMessages({ status, search, page = 1, limit = 20 }) {
  const clauses = [];
  const params = [];
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    clauses.push(`(name ILIKE ${p} OR email ILIKE ${p} OR phone ILIKE ${p} OR order_number ILIKE ${p} OR message ILIKE ${p})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const { rows } = await query(
    `SELECT * FROM contact_messages ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  const {
    rows: [{ count }],
  } = await query(`SELECT COUNT(*)::int AS count FROM contact_messages ${where}`, params);
  return { items: rows, total: count };
}

export async function countNewContactMessages() {
  const {
    rows: [{ count }],
  } = await query(`SELECT COUNT(*)::int AS count FROM contact_messages WHERE status = 'NEW'`);
  return count;
}

// PATCH semantics: only fields present in `fields` are written. Moving to
// RESOLVED stamps who/when; moving away from it clears that stamp.
export async function updateContactMessage(id, fields, adminId) {
  const sets = [];
  const params = [id];
  if (Object.hasOwn(fields, 'status')) {
    params.push(fields.status);
    sets.push(`status = $${params.length}`);
    if (fields.status === 'RESOLVED') {
      params.push(adminId);
      sets.push(`resolved_by = $${params.length}`, 'resolved_at = now()');
    } else {
      sets.push('resolved_by = NULL', 'resolved_at = NULL');
    }
  }
  if (Object.hasOwn(fields, 'adminNote')) {
    params.push(fields.adminNote);
    sets.push(`admin_note = $${params.length}`);
  }
  if (sets.length === 0) return findContactMessageById(id);
  sets.push('updated_at = now()');
  const { rows } = await query(`UPDATE contact_messages SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
  return rows[0] ?? null;
}
