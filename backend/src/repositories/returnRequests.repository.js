import { query } from '../config/db.js';

// "Active" = still open for the customer/admin (not yet rejected or
// completed) — used to block a second submission while one is already in
// flight, and to decide what the storefront shows instead of the request form.
const ACTIVE_STATUSES = ['REQUESTED', 'APPROVED'];

export async function findReturnRequestByOrderId(orderId) {
  const { rows } = await query(
    `SELECT r.*, a.full_name AS resolved_by_admin_name
     FROM return_requests r
     LEFT JOIN admin_users a ON a.id = r.resolved_by_admin_user_id
     WHERE r.order_id = $1
     ORDER BY r.created_at DESC
     LIMIT 1`,
    [orderId],
  );
  return rows[0] ?? null;
}

export async function findReturnRequestById(id) {
  const { rows } = await query('SELECT * FROM return_requests WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function hasActiveReturnRequest(orderId) {
  const { rows } = await query(
    `SELECT 1 FROM return_requests WHERE order_id = $1 AND status = ANY($2) LIMIT 1`,
    [orderId, ACTIVE_STATUSES],
  );
  return rows.length > 0;
}

export async function insertReturnRequest(orderId, { reason, note, videoUrl, photoUrls = [] }) {
  const { rows } = await query(
    `INSERT INTO return_requests (order_id, reason, note, video_url, photo_urls)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING *`,
    [orderId, reason, note ?? null, videoUrl ?? null, JSON.stringify(photoUrls)],
  );
  return rows[0];
}

export async function updateReturnRequestStatus(id, status, adminId) {
  const { rows } = await query(
    `UPDATE return_requests
     SET status = $2, resolved_at = now(), resolved_by_admin_user_id = $3
     WHERE id = $1
     RETURNING *`,
    [id, status, adminId],
  );
  return rows[0] ?? null;
}

// Customer-initiated, unlike updateReturnRequestStatus (admin approve/reject)
// — no resolved_by_admin_user_id, since no admin acted on it.
export async function cancelReturnRequestTx(client, id) {
  const { rows } = await client.query(
    `UPDATE return_requests SET status = 'CANCELLED', resolved_at = now() WHERE id = $1 RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
}

// System-driven completion (reverse pickup confirmed received at the
// warehouse) — distinct from updateReturnRequestStatus (an admin decision),
// so it doesn't stamp resolved_by_admin_user_id.
export async function completeReturnRequestTx(client, id) {
  const { rows } = await client.query(
    `UPDATE return_requests SET status = 'COMPLETED', resolved_at = now() WHERE id = $1 RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
}
