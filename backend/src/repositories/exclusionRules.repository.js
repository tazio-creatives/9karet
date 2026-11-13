import { query } from '../config/db.js';

// Rules are stored canonicalized (the two attribute_value ids sorted as
// text) so the same pair is always representable one way, regardless of
// which value the admin picked first when creating it.
function canonicalPair(valueIdA, valueIdB) {
  return valueIdA < valueIdB ? [valueIdA, valueIdB] : [valueIdB, valueIdA];
}

const RULE_SELECT = `
  SELECT r.id, r.product_id,
    jsonb_build_object('id', avA.id, 'attributeCode', aA.code, 'attributeName', aA.name, 'label', avA.label) AS value_a,
    jsonb_build_object('id', avB.id, 'attributeCode', aB.code, 'attributeName', aB.name, 'label', avB.label) AS value_b
  FROM attribute_value_exclusion_rules r
  JOIN attribute_values avA ON avA.id = r.attribute_value_id_a
  JOIN attributes aA ON aA.id = avA.attribute_id
  JOIN attribute_values avB ON avB.id = r.attribute_value_id_b
  JOIN attributes aB ON aB.id = avB.attribute_id
`;

export async function findExclusionRulesByProduct(productId) {
  const { rows } = await query(`${RULE_SELECT} WHERE r.product_id = $1 ORDER BY r.created_at`, [productId]);
  return rows;
}

// Lean shape for sync-time rule application — just the two value ids per
// rule, no label joins.
export async function findExclusionPairsByProduct(productId) {
  const { rows } = await query(
    'SELECT id, attribute_value_id_a, attribute_value_id_b FROM attribute_value_exclusion_rules WHERE product_id = $1',
    [productId],
  );
  return rows;
}

export async function createExclusionRule(productId, valueIdA, valueIdB) {
  const [a, b] = canonicalPair(valueIdA, valueIdB);
  const { rows } = await query(
    `INSERT INTO attribute_value_exclusion_rules (product_id, attribute_value_id_a, attribute_value_id_b)
     VALUES ($1, $2, $3)
     ON CONFLICT (product_id, attribute_value_id_a, attribute_value_id_b) DO UPDATE SET product_id = EXCLUDED.product_id
     RETURNING id`,
    [productId, a, b],
  );
  const { rows: full } = await query(`${RULE_SELECT} WHERE r.id = $1`, [rows[0].id]);
  return full[0];
}

export async function deleteExclusionRule(productId, ruleId) {
  // Revert affected variants BEFORE the row is gone — the FK's
  // ON DELETE SET NULL races ahead of any post-delete "was this
  // rule-excluded" check (it nulls excluded_by_rule_id itself as part of
  // the DELETE), which would otherwise make a since-deleted rule
  // indistinguishable from "never rule-excluded" and leave is_available
  // stuck at false forever. applyExclusionRules (called by the caller
  // right after this) re-derives the correct final state — including
  // correctly re-excluding a variant that still matches a *different*
  // remaining rule.
  await query(
    'UPDATE product_variants SET is_available = true, excluded_by_rule_id = NULL WHERE excluded_by_rule_id = $1',
    [ruleId],
  );
  await query('DELETE FROM attribute_value_exclusion_rules WHERE id = $1 AND product_id = $2', [ruleId, productId]);
}
