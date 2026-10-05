import { query } from '../config/db.js';

// Admin "First 50 Products" order for one placement (see the
// 20261005040000 migration). Storefront ordering reads this table directly
// via a join in products.repository.js#listProducts.

export async function findDisplayOrder(placementType, placementId) {
  const { rows } = await query(
    `SELECT product_id, position FROM product_display_order
     WHERE placement_type = $1 AND placement_id = $2
     ORDER BY position`,
    [placementType, placementId],
  );
  return rows;
}

// Replace the whole order in one go — run inside withTransaction so a
// failure never leaves a half-saved order behind.
export async function replaceDisplayOrder(placementType, placementId, productIds) {
  await query('DELETE FROM product_display_order WHERE placement_type = $1 AND placement_id = $2', [
    placementType,
    placementId,
  ]);
  if (productIds.length === 0) return;
  await query(
    `INSERT INTO product_display_order (placement_type, placement_id, product_id, position)
     SELECT $1, $2, ids.product_id, ids.position
     FROM unnest($3::uuid[]) WITH ORDINALITY AS ids(product_id, position)`,
    [placementType, placementId, productIds],
  );
}

export async function deleteDisplayOrder(placementType, placementId) {
  await query('DELETE FROM product_display_order WHERE placement_type = $1 AND placement_id = $2', [
    placementType,
    placementId,
  ]);
}
