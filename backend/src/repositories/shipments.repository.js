import { query } from '../config/db.js';

// FORWARD-only — a REVERSE (reverse pickup) row can exist for the same
// order_id, and would otherwise win the ORDER BY created_at DESC LIMIT 1
// once created, silently swapping what the order-detail page shows.
export async function findShipmentByOrderId(orderId) {
  const { rows } = await query(
    `SELECT * FROM shipments WHERE order_id = $1 AND direction = 'FORWARD' ORDER BY created_at DESC LIMIT 1`,
    [orderId],
  );
  return rows[0] ?? null;
}

export async function findReversePickupByReturnRequestId(returnRequestId) {
  const { rows } = await query('SELECT * FROM shipments WHERE return_request_id = $1', [returnRequestId]);
  return rows[0] ?? null;
}

export async function insertShipment({
  orderId,
  provider,
  providerShipmentId,
  trackingNumber,
  courierName,
  status,
  packageWeightGrams,
  packageLengthCm,
  packageWidthCm,
  packageHeightCm,
  labelUrl,
  direction = 'FORWARD',
  returnRequestId = null,
}) {
  const { rows } = await query(
    `INSERT INTO shipments
       (order_id, provider, provider_shipment_id, tracking_number, courier_name, status,
        package_weight_grams, package_length_cm, package_width_cm, package_height_cm, label_url,
        direction, return_request_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [
      orderId,
      provider,
      providerShipmentId,
      trackingNumber ?? null,
      courierName ?? null,
      status,
      packageWeightGrams ?? null,
      packageLengthCm ?? null,
      packageWidthCm ?? null,
      packageHeightCm ?? null,
      labelUrl ?? null,
      direction,
      returnRequestId,
    ],
  );
  return rows[0];
}

// Poll target list for the tracking-sync job — mirrors the partial index
// added by the 20260920000000 migration (status not yet terminal).
export async function findShipmentsPendingTracking() {
  const { rows } = await query(
    // Finished reverse pickups (received back / cancelled) are terminal too —
    // REVERSE_PICKUP_FAILED is not, since Delhivery reattempts the pickup.
    `SELECT * FROM shipments
     WHERE status NOT IN ('DELIVERED', 'RETURNED', 'CANCELLED', 'REVERSE_RECEIVED', 'REVERSE_PICKUP_CANCELLED')
     ORDER BY last_tracked_at ASC NULLS FIRST`,
  );
  return rows;
}

export async function updateShipmentTrackingTx(client, id, status, rawPayload) {
  const { rows } = await client.query(
    `UPDATE shipments SET status = $2, raw_webhook_payload = $3::jsonb, last_tracked_at = now(), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, status, JSON.stringify(rawPayload)],
  );
  return rows[0];
}

// Touches last_tracked_at without changing status — so a shipment whose
// courier status genuinely hasn't moved doesn't get re-polled ahead of
// older, more-likely-to-have-changed shipments (ORDER BY updated_at ASC
// above).
export async function touchShipmentTrackedAt(id) {
  await query('UPDATE shipments SET last_tracked_at = now() WHERE id = $1', [id]);
}

// Locked for the duration of the webhook transaction — same reasoning as
// payments.repository.js's findPaymentByProviderRefTx (plan §11b idempotency).
export async function findShipmentByProviderShipmentIdTx(client, providerShipmentId) {
  const { rows } = await client.query(
    'SELECT * FROM shipments WHERE provider_shipment_id = $1 FOR UPDATE',
    [providerShipmentId],
  );
  return rows[0] ?? null;
}

export async function updateShipmentStatusTx(client, id, status, rawPayload) {
  const { rows } = await client.query(
    `UPDATE shipments SET status = $2, raw_webhook_payload = $3::jsonb, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, status, JSON.stringify(rawPayload)],
  );
  return rows[0];
}

export async function updateShipmentStatusSimpleTx(client, id, status) {
  const { rows } = await client.query(
    `UPDATE shipments SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, status],
  );
  return rows[0];
}

export async function insertShipmentTrackingEvent({ shipmentId, status, location, note, source = 'MANUAL' }) {
  const { rows } = await query(
    `INSERT INTO shipment_tracking_events (shipment_id, status, location, note, source)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [shipmentId, status, location ?? null, note ?? null, source],
  );
  return rows[0];
}

export async function insertShipmentTrackingEventTx(client, { shipmentId, status, location, note, source = 'MANUAL' }) {
  const { rows } = await client.query(
    `INSERT INTO shipment_tracking_events (shipment_id, status, location, note, source)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [shipmentId, status, location ?? null, note ?? null, source],
  );
  return rows[0];
}

export async function findTrackingEventsByShipmentId(shipmentId) {
  const { rows } = await query(
    'SELECT * FROM shipment_tracking_events WHERE shipment_id = $1 ORDER BY created_at DESC',
    [shipmentId],
  );
  return rows;
}
