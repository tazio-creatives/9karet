import { query } from '../config/db.js';

// Exactly one row per product (the partial unique index on is_active=true
// enforces this — see the 20260911010000 migration), evolving through
// generating -> passed|warning|failed -> stale -> generating again, rather
// than a new row per attempt. This keeps "is there currently a displayable
// Product Size Image" a single, unambiguous lookup with no risk of two
// "active" rows ever existing for the same product.
export async function findByProductId(productId) {
  const { rows } = await query('SELECT * FROM product_size_generated_images WHERE product_id = $1', [productId]);
  return rows[0] ?? null;
}

// Called right before enqueueing a generation job. Upserts onto the same
// per-product row (via the partial unique index) so a fresh attempt never
// collides with — or duplicates — whatever row already exists, and clears
// any previous failure_reason from a prior failed attempt.
export async function beginGeneration(productId, measurementVersion) {
  const { rows } = await query(
    `INSERT INTO product_size_generated_images (product_id, measurement_version, status, is_active)
     VALUES ($1, $2, 'generating', true)
     ON CONFLICT (product_id) WHERE is_active = true
     DO UPDATE SET status = 'generating', measurement_version = $2, failure_reason = NULL, updated_at = now()
     RETURNING *`,
    [productId, measurementVersion],
  );
  return rows[0];
}

// On success, imageSortOrder overwrites the stored pointer (COALESCE keeps
// the previous value on a failure, where imageSortOrder is passed as null —
// so a failed regeneration never loses track of the still-live prior image).
// generated_at is set here — and ONLY here — so it reflects the moment a
// generation attempt actually finished (pass/warning/fail), never touched by
// beginGeneration (job enqueued) or markStale (measurements edited), unlike
// updated_at which changes on all three.
export async function markResult(productId, { status, imageSortOrder = null, failureReason = null }) {
  const { rows } = await query(
    `UPDATE product_size_generated_images
     SET status = $2, image_sort_order = COALESCE($3, image_sort_order), failure_reason = $4, updated_at = now(), generated_at = now()
     WHERE product_id = $1
     RETURNING *`,
    [productId, status, imageSortOrder, failureReason],
  );
  return rows[0] ?? null;
}

// Called the moment measurements are saved with a real change (see
// productSizeMeasurements.repository.js's version bump) — a currently
// passed/warning image is no longer trustworthy against the new numbers.
// Applied unconditionally (not just from passed/warning) so a mid-flight
// "generating" row is also correctly superseded rather than racing a stale
// generation back into "live".
export async function markStale(productId) {
  await query(
    `UPDATE product_size_generated_images SET status = 'stale', updated_at = now() WHERE product_id = $1`,
    [productId],
  );
}
