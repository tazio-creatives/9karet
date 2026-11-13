import { query } from '../config/db.js';

export async function insertAuditLog({ adminUserId, action, entity, entityId, diff }) {
  await query(
    `INSERT INTO audit_logs (admin_user_id, action, entity, entity_id, diff)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminUserId, action, entity, entityId ?? null, diff ? JSON.stringify(diff) : null],
  );
}

export async function listAuditLogs({ entity, page = 1, limit = 50 } = {}) {
  const clauses = [];
  const params = [];
  if (entity) {
    params.push(entity);
    clauses.push(`a.entity = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const listParams = [...params, limit, offset];

  const { rows } = await query(
    `SELECT a.*, u.email AS admin_email, u.full_name AS admin_full_name
     FROM audit_logs a
     LEFT JOIN admin_users u ON u.id = a.admin_user_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  const {
    rows: [{ count }],
  } = await query(`SELECT COUNT(*)::int AS count FROM audit_logs a ${where}`, params);

  return { items: rows, total: count };
}
