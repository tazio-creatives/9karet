import { query } from '../config/db.js';

// Read while holding the FOR UPDATE lock on the variant row (plan §11) —
// gives the true "available right now" figure with no race window.
export async function getActiveReservedQuantityTx(client, variantId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(quantity), 0)::int AS reserved
     FROM stock_reservations WHERE product_variant_id = $1 AND status = 'ACTIVE'`,
    [variantId],
  );
  return rows[0].reserved;
}

export async function insertReservationTx(client, { productId, productVariantId, orderId, quantity, expiresAt }) {
  const { rows } = await client.query(
    `INSERT INTO stock_reservations (product_id, product_variant_id, order_id, quantity, status, expires_at)
     VALUES ($1, $2, $3, $4, 'ACTIVE', $5) RETURNING *`,
    [productId, productVariantId, orderId, quantity, expiresAt],
  );
  return rows[0];
}

export async function findReservationsForOrderTx(client, orderId) {
  const { rows } = await client.query('SELECT * FROM stock_reservations WHERE order_id = $1', [
    orderId,
  ]);
  return rows;
}

// Payment webhook success path (plan §11): the hold becomes a real
// decrement — CONFIRMED reservations no longer count toward "reserved" (the
// stock they cover is now permanently gone from the variant's stock_quantity
// instead).
export async function confirmReservationsForOrderTx(client, orderId) {
  const reservations = await findReservationsForOrderTx(client, orderId);
  for (const reservation of reservations) {
    if (reservation.status !== 'ACTIVE') continue;
    if (reservation.product_variant_id) {
      await client.query(
        `UPDATE product_variants SET stock_quantity = stock_quantity - $2 WHERE id = $1`,
        [reservation.product_variant_id, reservation.quantity],
      );
    }
    await client.query(`UPDATE stock_reservations SET status = 'CONFIRMED' WHERE id = $1`, [
      reservation.id,
    ]);
  }
}

// Sweep job / cancellation path — no stock impact since nothing was ever
// decremented for an ACTIVE reservation, just releases the hold.
export async function releaseReservationsForOrderTx(client, orderId) {
  await client.query(
    `UPDATE stock_reservations SET status = 'RELEASED' WHERE order_id = $1 AND status = 'ACTIVE'`,
    [orderId],
  );
}

// Cancellation of an already-PAID order — the inverse of
// confirmReservationsForOrderTx: CONFIRMED reservations had their quantity
// permanently decremented from the variant at payment, so it's added back
// here before the reservation is released. ACTIVE ones (never decremented)
// are just released.
export async function restoreStockForOrderTx(client, orderId) {
  const reservations = await findReservationsForOrderTx(client, orderId);
  for (const reservation of reservations) {
    if (reservation.status === 'CONFIRMED' && reservation.product_variant_id) {
      await client.query(
        `UPDATE product_variants SET stock_quantity = stock_quantity + $2 WHERE id = $1`,
        [reservation.product_variant_id, reservation.quantity],
      );
    }
    if (reservation.status !== 'RELEASED') {
      await client.query(`UPDATE stock_reservations SET status = 'RELEASED' WHERE id = $1`, [reservation.id]);
    }
  }
}

// True while a paid order's stock hasn't been put back yet (CONFIRMED
// variant reservations remain) — drives the admin "Add back to stock" button.
export async function hasRestorableStock(orderId) {
  const { rows } = await query(
    `SELECT 1 FROM stock_reservations
     WHERE order_id = $1 AND status = 'CONFIRMED' AND product_variant_id IS NOT NULL LIMIT 1`,
    [orderId],
  );
  return rows.length > 0;
}

export async function findExpiredActiveReservationOrderIds() {
  const { rows } = await query(
    `SELECT DISTINCT order_id FROM stock_reservations
     WHERE status = 'ACTIVE' AND expires_at < now()`,
  );
  return rows.map((r) => r.order_id);
}
