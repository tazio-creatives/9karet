import { query } from '../config/db.js';

export async function findWorkOrderPrints(orderId) {
  const { rows } = await query(
    `SELECT w.*, a.full_name AS admin_name
     FROM work_order_prints w
     LEFT JOIN admin_users a ON a.id = w.admin_user_id
     WHERE w.order_id = $1
     ORDER BY w.printed_at`,
    [orderId],
  );
  return rows;
}

export async function insertWorkOrderPrint(orderId, adminId) {
  const { rows } = await query(
    'INSERT INTO work_order_prints (order_id, admin_user_id) VALUES ($1, $2) RETURNING *',
    [orderId, adminId],
  );
  return rows[0];
}
