import { query } from '../config/db.js';

export async function insertPayment({ orderId, provider, providerRef, status, amount }) {
  const { rows } = await query(
    `INSERT INTO payments (order_id, provider, provider_ref, status, amount)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [orderId, provider, providerRef, status, amount],
  );
  return rows[0];
}

// Locked for the duration of the confirm transaction — a second delivery of
// the same webhook arriving concurrently blocks until the first finishes,
// so idempotency holds even under real concurrent retries, not just
// sequential ones.
export async function findPaymentByProviderRefTx(client, providerRef) {
  const { rows } = await client.query('SELECT * FROM payments WHERE provider_ref = $1 FOR UPDATE', [
    providerRef,
  ]);
  return rows[0] ?? null;
}

export async function updatePaymentStatusTx(client, id, status, rawPayload) {
  const { rows } = await client.query(
    `UPDATE payments SET status = $2, raw_payload = $3::jsonb, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, status, JSON.stringify(rawPayload)],
  );
  return rows[0];
}

export async function findPaymentByProviderRef(providerRef) {
  const { rows } = await query('SELECT * FROM payments WHERE provider_ref = $1', [providerRef]);
  return rows[0] ?? null;
}

export async function findPaymentByOrderId(orderId) {
  const { rows } = await query(
    'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
    [orderId],
  );
  return rows[0] ?? null;
}

// Saves Cashfree's transaction details next to the stored webhook event.
export async function savePaymentDetails(id, details) {
  await query(
    `UPDATE payments SET raw_payload = COALESCE(raw_payload, '{}'::jsonb) || jsonb_build_object('details', $2::jsonb),
       updated_at = now()
     WHERE id = $1`,
    [id, JSON.stringify(details)],
  );
}
