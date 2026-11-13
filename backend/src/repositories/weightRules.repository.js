import { query } from '../config/db.js';

const RULE_SELECT = `
  SELECT r.id, r.purity_value_id, r.size_value_id, r.gold_weight_grams,
    pav.label AS purity_label, pav.value AS purity_value,
    sav.label AS size_label
  FROM product_weight_rules r
  JOIN attribute_values pav ON pav.id = r.purity_value_id
  LEFT JOIN attribute_values sav ON sav.id = r.size_value_id
`;

// Lean shape (just the ids + weight) for computeVariantPricing's resolution
// — no label joins, this runs on the hot price-computation path.
export async function findWeightRuleValuesByProduct(productId) {
  const { rows } = await query(
    'SELECT purity_value_id, size_value_id, gold_weight_grams FROM product_weight_rules WHERE product_id = $1',
    [productId],
  );
  return rows;
}

// Label-resolved shape for the admin UI.
export async function findWeightRulesByProduct(productId) {
  const { rows } = await query(`${RULE_SELECT} WHERE r.product_id = $1 ORDER BY pav.sort_order, sav.sort_order`, [
    productId,
  ]);
  return rows;
}

// Full replace — the admin's "Weight Defaults" screen edits the whole set
// (a purity table, and/or a purity+size matrix) and saves it in one action,
// so an atomic delete-then-insert of the complete desired state is simpler
// and less error-prone here than diffing individual rows.
export async function replaceWeightRules(productId, rules) {
  await query('DELETE FROM product_weight_rules WHERE product_id = $1', [productId]);
  if (!rules.length) return;
  const values = [];
  const rows = rules.map((r, i) => {
    values.push(productId, r.purityValueId, r.sizeValueId ?? null, r.goldWeightGrams);
    const base = i * 4;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
  });
  await query(
    `INSERT INTO product_weight_rules (product_id, purity_value_id, size_value_id, gold_weight_grams)
     VALUES ${rows.join(', ')}
     ON CONFLICT DO NOTHING`,
    values,
  );
}
