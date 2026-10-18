import { query } from '../config/db.js';

const RULE_SELECT = `
  SELECT r.id, r.purity_value_id, r.making_charge_percent, r.making_charge_discount_percent, r.stone_discount_percent,
    pav.label AS purity_label, pav.value AS purity_value
  FROM product_purity_pricing_rules r
  JOIN attribute_values pav ON pav.id = r.purity_value_id
`;

// Lean shape (no label join) for computeVariantPricing's resolution — this
// runs on the hot price-computation path, same reasoning as
// findWeightRuleValuesByProduct.
export async function findPurityPricingRuleValuesByProduct(productId) {
  const { rows } = await query(
    `SELECT purity_value_id, making_charge_percent, making_charge_discount_percent, stone_discount_percent
     FROM product_purity_pricing_rules WHERE product_id = $1`,
    [productId],
  );
  return rows;
}

// Batch variant of findPurityPricingRuleValuesByProduct — one query for many
// products (Pricing Rule Management's preview endpoint, which resolves
// discounts for up to a whole category/global scope without an N+1).
export async function findPurityPricingRuleValuesByProductIds(productIds) {
  if (productIds.length === 0) return new Map();
  const { rows } = await query(
    `SELECT product_id, purity_value_id, making_charge_percent, making_charge_discount_percent, stone_discount_percent
     FROM product_purity_pricing_rules WHERE product_id = ANY($1)`,
    [productIds],
  );
  const byProduct = new Map();
  for (const row of rows) {
    if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, []);
    byProduct.get(row.product_id).push(row);
  }
  return byProduct;
}

// Label-resolved shape for the admin UI.
export async function findPurityPricingRulesByProduct(productId) {
  const { rows } = await query(`${RULE_SELECT} WHERE r.product_id = $1 ORDER BY pav.sort_order`, [productId]);
  return rows;
}

// Single-row lookup by Product + Purity — used by the audit script and
// anywhere else that needs one specific rule without fetching the whole set.
export async function findPurityPricingRuleByProductAndPurity(productId, purityValueId) {
  const { rows } = await query(`${RULE_SELECT} WHERE r.product_id = $1 AND r.purity_value_id = $2`, [
    productId,
    purityValueId,
  ]);
  return rows[0] ?? null;
}

// Full replace — mirrors replaceWeightRules: the admin's "Purity Pricing
// Rules" panel edits the whole set and saves it in one action, so an atomic
// delete-then-insert of the complete desired state is simpler than diffing
// individual rows. A rule whose three fields are all null is never inserted
// — a missing row IS the "fully inherited" state, so there's no reason to
// persist an all-null row that means exactly the same thing as no row.
export async function replacePurityPricingRules(productId, rules) {
  await query('DELETE FROM product_purity_pricing_rules WHERE product_id = $1', [productId]);
  const rowsToInsert = rules.filter(
    (r) => r.makingChargePercent != null || r.makingChargeDiscountPercent != null || r.stoneDiscountPercent != null,
  );
  if (!rowsToInsert.length) return;
  const values = [];
  const placeholders = rowsToInsert.map((r, i) => {
    values.push(productId, r.purityValueId, r.makingChargePercent, r.makingChargeDiscountPercent, r.stoneDiscountPercent);
    const base = i * 5;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
  });
  await query(
    `INSERT INTO product_purity_pricing_rules
       (product_id, purity_value_id, making_charge_percent, making_charge_discount_percent, stone_discount_percent)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT DO NOTHING`,
    values,
  );
}
