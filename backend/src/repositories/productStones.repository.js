import { query } from '../config/db.js';

// A product's stone lines, in display order, each with its type's name
// joined in — what pricing (stone value, discount rules by stone type), the
// PDP's stone details and the order-time snapshot all read.
export async function findStonesByProductId(productId) {
  const { rows } = await query(
    `SELECT ps.id, ps.stone_type_id, st.name AS stone_type_name, ps.stone_count,
            ps.weight_carats, ps.price, ps.sort_order
     FROM product_stones ps
     JOIN stone_types st ON st.id = ps.stone_type_id
     WHERE ps.product_id = $1
     ORDER BY ps.sort_order, ps.created_at`,
    [productId],
  );
  return rows;
}

// Batch variant for listing/cart paths that hydrate many products at once.
// Returns Map(productId -> rows[]), every requested id present (empty array
// for a product with no stones).
export async function findStonesByProductIds(productIds) {
  const byProduct = new Map(productIds.map((id) => [id, []]));
  if (productIds.length === 0) return byProduct;
  const { rows } = await query(
    `SELECT ps.product_id, ps.id, ps.stone_type_id, st.name AS stone_type_name, ps.stone_count,
            ps.weight_carats, ps.price, ps.sort_order
     FROM product_stones ps
     JOIN stone_types st ON st.id = ps.stone_type_id
     WHERE ps.product_id = ANY($1)
     ORDER BY ps.product_id, ps.sort_order, ps.created_at`,
    [productIds],
  );
  for (const row of rows) byProduct.get(row.product_id)?.push(row);
  return byProduct;
}

// The product form edits the whole stone list at once, so this is a full
// replace (same DELETE-then-INSERT shape as replaceWeightRules). Uses the
// ambient query(), so it joins the product save's transaction.
export async function replaceProductStones(productId, stones) {
  await query('DELETE FROM product_stones WHERE product_id = $1', [productId]);
  for (const [i, s] of stones.entries()) {
    await query(
      `INSERT INTO product_stones (product_id, stone_type_id, stone_count, weight_carats, price, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, s.stoneTypeId, s.count, s.weightCarats, s.price, i],
    );
  }
}
