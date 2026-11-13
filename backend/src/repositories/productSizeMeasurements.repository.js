import { query } from '../config/db.js';

export async function findMeasurementsByProductId(productId) {
  const { rows } = await query('SELECT * FROM product_size_measurements WHERE product_id = $1', [productId]);
  return rows[0] ?? null;
}

// version only increments when a field that actually affects the rendered
// image or its labels changes — jewellery_type is informational only (used
// to decide whether a saved form should be discarded as belonging to a
// different category) and deliberately excluded from the version-bump
// comparison, since re-confirming the same category shouldn't invalidate an
// otherwise-unchanged, already-generated image.
export async function upsertMeasurements(productId, { jewelleryType, unit, measurements, includedParts, excludedParts, note }) {
  const { rows } = await query(
    `INSERT INTO product_size_measurements (product_id, jewellery_type, unit, measurements, included_parts, excluded_parts, note, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
     ON CONFLICT (product_id) DO UPDATE SET
       jewellery_type = EXCLUDED.jewellery_type,
       unit = EXCLUDED.unit,
       measurements = EXCLUDED.measurements,
       included_parts = EXCLUDED.included_parts,
       excluded_parts = EXCLUDED.excluded_parts,
       note = EXCLUDED.note,
       version = CASE
         WHEN product_size_measurements.unit IS DISTINCT FROM EXCLUDED.unit
           OR product_size_measurements.measurements IS DISTINCT FROM EXCLUDED.measurements
           OR product_size_measurements.included_parts IS DISTINCT FROM EXCLUDED.included_parts
           OR product_size_measurements.excluded_parts IS DISTINCT FROM EXCLUDED.excluded_parts
           OR product_size_measurements.note IS DISTINCT FROM EXCLUDED.note
         THEN product_size_measurements.version + 1
         ELSE product_size_measurements.version
       END,
       updated_at = now()
     RETURNING *`,
    [
      productId,
      jewelleryType ?? null,
      unit,
      JSON.stringify(measurements ?? {}),
      JSON.stringify(includedParts ?? []),
      JSON.stringify(excludedParts ?? []),
      note ?? null,
    ],
  );
  return rows[0];
}
