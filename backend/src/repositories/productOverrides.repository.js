import { query } from '../config/db.js';

// "Override" here means a product-level DISCOUNT override specifically —
// the two things that outrank Category/Global pricing rules per the
// resolver's tier order (§2): a product_purity_pricing_rules row's
// making_charge_discount_percent/stone_discount_percent (tier 2), or the
// flat products.making_charge_discount_percent/stone_discount_percent
// columns (tier 3). Deliberately excludes making_charge_percent — that's a
// base-charge configuration, not a discount, and isn't part of what a
// Category/Global rule ever competes with.
const OVERRIDE_FLAGS_CTE = `
  WITH override_flags AS (
    SELECT p.id,
      (COALESCE(p.making_charge_discount_percent, 0) > 0 OR EXISTS (
        SELECT 1 FROM product_purity_pricing_rules ppr
        WHERE ppr.product_id = p.id AND ppr.making_charge_discount_percent IS NOT NULL
      )) AS has_making_override,
      (COALESCE(p.stone_discount_percent, 0) > 0 OR EXISTS (
        SELECT 1 FROM product_purity_pricing_rules ppr
        WHERE ppr.product_id = p.id AND ppr.stone_discount_percent IS NOT NULL
      )) AS has_stone_override
    FROM products p
  )
`;

const LIST_COLUMNS = `
  p.id, p.sku, p.name, p.slug, p.category_id, cat.name AS category_name,
  p.making_charge_discount_percent AS flat_making_discount_percent,
  p.stone_discount_percent AS flat_stone_discount_percent,
  p.effective_making_charge_discount_percent, p.effective_stone_discount_percent,
  p.effective_making_charge_rule_id, p.effective_stone_rule_id,
  of.has_making_override, of.has_stone_override,
  EXISTS (
    SELECT 1 FROM pricing_rule_audit_logs pal
    WHERE pal.product_id = p.id AND pal.action IN ('OVERRIDE_REMOVED', 'BULK_OVERRIDE_ACTION')
  ) AS has_restorable_override
`;

function buildFilters({ search, categoryId, purityValueId, hasMakingOverride, hasStoneOverride, appliedRuleId }) {
  const clauses = ['(of.has_making_override OR of.has_stone_override)'];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
  }
  if (categoryId) {
    params.push(categoryId);
    clauses.push(`p.category_id = $${params.length}`);
  }
  if (hasMakingOverride != null) {
    params.push(hasMakingOverride);
    clauses.push(`of.has_making_override = $${params.length}`);
  }
  if (hasStoneOverride != null) {
    params.push(hasStoneOverride);
    clauses.push(`of.has_stone_override = $${params.length}`);
  }
  if (appliedRuleId) {
    params.push(appliedRuleId);
    clauses.push(`(p.effective_making_charge_rule_id = $${params.length} OR p.effective_stone_rule_id = $${params.length})`);
  }
  if (purityValueId) {
    params.push(purityValueId);
    clauses.push(`EXISTS (
      SELECT 1 FROM product_purity_pricing_rules ppr
      WHERE ppr.product_id = p.id AND ppr.purity_value_id = $${params.length}
        AND (ppr.making_charge_discount_percent IS NOT NULL OR ppr.stone_discount_percent IS NOT NULL)
    )`);
  }

  return { where: `WHERE ${clauses.join(' AND ')}`, params };
}

export async function findProductOverrides(filters, { page = 1, limit = 25 } = {}) {
  const { where, params } = buildFilters(filters);
  const offset = (page - 1) * limit;
  const listParams = [...params, limit, offset];
  const { rows } = await query(
    `${OVERRIDE_FLAGS_CTE}
     SELECT ${LIST_COLUMNS} FROM products p
     JOIN override_flags of ON of.id = p.id
     LEFT JOIN categories cat ON cat.id = p.category_id
     ${where}
     ORDER BY p.name
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  const {
    rows: [{ count }],
  } = await query(
    `${OVERRIDE_FLAGS_CTE}
     SELECT COUNT(*)::int AS count FROM products p JOIN override_flags of ON of.id = p.id ${where}`,
    params,
  );
  return { items: rows, total: count };
}

// Full current override state for one product — captured before any clear,
// so RESTORE_PREVIOUS_OVERRIDES can write it back exactly. Includes BOTH
// making-charge and stone fields regardless of which single action is
// about to run, so one restore later is always complete even if a product
// was touched by REMOVE_MAKING_OVERRIDE and REMOVE_STONE_OVERRIDE
// separately on different occasions.
export async function captureOverrideSnapshot(productId) {
  const {
    rows: [product],
  } = await query(
    `SELECT making_charge_discount_percent, stone_discount_percent FROM products WHERE id = $1`,
    [productId],
  );
  const { rows: purityRows } = await query(
    `SELECT purity_value_id, making_charge_discount_percent, stone_discount_percent
     FROM product_purity_pricing_rules WHERE product_id = $1
     AND (making_charge_discount_percent IS NOT NULL OR stone_discount_percent IS NOT NULL)`,
    [productId],
  );
  return {
    flatMakingChargeDiscountPercent: product?.making_charge_discount_percent ?? null,
    flatStoneDiscountPercent: product?.stone_discount_percent ?? null,
    purityRows: purityRows.map((r) => ({
      purityValueId: r.purity_value_id,
      makingChargeDiscountPercent: r.making_charge_discount_percent,
      stoneDiscountPercent: r.stone_discount_percent,
    })),
  };
}

// Nulls/zeroes the making-charge discount override only — never touches
// making_charge_percent (a base-charge setting, not a discount), gold_value,
// stone_value, selling_price history, or the purity-rule ROWS themselves
// (only the one field within them). No row is ever deleted here.
export async function clearMakingOverride(productId) {
  await query(`UPDATE products SET making_charge_discount_percent = 0 WHERE id = $1`, [productId]);
  await query(
    `UPDATE product_purity_pricing_rules SET making_charge_discount_percent = NULL WHERE product_id = $1`,
    [productId],
  );
}

export async function clearStoneOverride(productId) {
  await query(`UPDATE products SET stone_discount_percent = 0 WHERE id = $1`, [productId]);
  await query(
    `UPDATE product_purity_pricing_rules SET stone_discount_percent = NULL WHERE product_id = $1`,
    [productId],
  );
}

// Writes a captureOverrideSnapshot() result back — an upsert on the purity
// rows (not a plain UPDATE) since a row can have been pruned in the
// meantime (e.g. the purity option was removed from the product elsewhere;
// variantSyncService.js already prunes orphaned purity-pricing rows on a
// product save). Never deletes anything either.
export async function restoreOverrideSnapshot(productId, snapshot) {
  await query(
    `UPDATE products SET making_charge_discount_percent = $2, stone_discount_percent = $3 WHERE id = $1`,
    [productId, snapshot.flatMakingChargeDiscountPercent ?? 0, snapshot.flatStoneDiscountPercent ?? 0],
  );
  for (const row of snapshot.purityRows ?? []) {
    await query(
      `INSERT INTO product_purity_pricing_rules (product_id, purity_value_id, making_charge_discount_percent, stone_discount_percent)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, purity_value_id) DO UPDATE SET
         making_charge_discount_percent = EXCLUDED.making_charge_discount_percent,
         stone_discount_percent = EXCLUDED.stone_discount_percent`,
      [productId, row.purityValueId, row.makingChargeDiscountPercent, row.stoneDiscountPercent],
    );
  }
}
