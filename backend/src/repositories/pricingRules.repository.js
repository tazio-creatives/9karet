import { query } from '../config/db.js';

// Everything a live rule needs for resolution — no join, so this stays cheap
// even as the table grows; scope/condition rows are fetched separately in
// bulk by pricingRuleResolver.js, keyed off the ids this returns. Also used
// as the admin-facing read shape (pricingRuleService.js) — notes/created_by/
// updated_by/updated_at are extra weight the resolver's hot path doesn't
// need but never queries separately either, so one shared column list is
// simpler than two.
const RULE_COLUMNS = `
  id, rule_type, name, scope, discount_type, discount_value, purity_scope, override_mode,
  starts_at, ends_at, status, priority, notes, created_by, updated_by, created_at, updated_at
`;

// Candidate rule set for resolution: SCHEDULED is included alongside ACTIVE
// because isLive() (pricingRuleResolver.js) derives real liveness from
// starts_at/ends_at itself — a SCHEDULED rule whose start has passed is live
// even if the 5-minute status-sweep cron (Phase 2) hasn't flipped its status
// column yet. DRAFT/EXPIRED/DISABLED rules are never candidates.
export async function findLiveRules() {
  const { rows } = await query(
    `SELECT ${RULE_COLUMNS} FROM pricing_rules WHERE status IN ('ACTIVE', 'SCHEDULED')`,
  );
  return rows;
}

export async function findRuleById(id) {
  const { rows } = await query(`SELECT ${RULE_COLUMNS} FROM pricing_rules WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listRules({ ruleType, status, scope, search, page = 1, limit = 25 } = {}) {
  const clauses = [];
  const params = [];
  if (ruleType) {
    params.push(ruleType);
    clauses.push(`rule_type = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (scope) {
    params.push(scope);
    clauses.push(`scope = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`name ILIKE $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const listParams = [...params, limit, offset];
  const { rows } = await query(
    `SELECT ${RULE_COLUMNS} FROM pricing_rules ${where}
     ORDER BY created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  const {
    rows: [{ count }],
  } = await query(`SELECT COUNT(*)::int AS count FROM pricing_rules ${where}`, params);
  return { items: rows, total: count };
}

// camelCase input keys -> snake_case columns, same generic-builder pattern
// as products.repository.js's PRODUCT_FIELD_MAP.
const RULE_WRITE_COLUMNS = [
  'rule_type',
  'name',
  'scope',
  'discount_type',
  'discount_value',
  'purity_scope',
  'override_mode',
  'starts_at',
  'ends_at',
  'status',
  'priority',
  'notes',
  'created_by',
  'updated_by',
];
const RULE_FIELD_MAP = Object.fromEntries(
  RULE_WRITE_COLUMNS.map((column) => [column.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), column]),
);

export async function insertRule(fields) {
  const columns = [];
  const placeholders = [];
  const values = [];
  for (const [key, column] of Object.entries(RULE_FIELD_MAP)) {
    if (Object.hasOwn(fields, key)) {
      values.push(fields[key]);
      columns.push(column);
      placeholders.push(`$${values.length}`);
    }
  }
  const {
    rows: [{ id }],
  } = await query(`INSERT INTO pricing_rules (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`, values);
  return findRuleById(id);
}

export async function updateRule(id, fields) {
  const values = [id];
  const setClauses = [];
  for (const [key, column] of Object.entries(RULE_FIELD_MAP)) {
    if (Object.hasOwn(fields, key)) {
      values.push(fields[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }
  if (setClauses.length === 0) return findRuleById(id);
  setClauses.push('updated_at = now()');
  await query(`UPDATE pricing_rules SET ${setClauses.join(', ')} WHERE id = $1`, values);
  return findRuleById(id);
}

export async function deleteRule(id) {
  await query('DELETE FROM pricing_rules WHERE id = $1', [id]);
}

// Full-replace pattern for each scope/condition join table — mirrors
// purityPricingRules.repository.js's replacePurityPricingRules (the admin
// edits the whole set and saves it in one action, so delete-then-insert is
// simpler and safer than diffing individual rows). All no-ops on an empty
// array (leaving the table empty, not inserting a meaningless empty row).
export async function replaceRuleCategories(ruleId, categoryIds) {
  await query('DELETE FROM pricing_rule_categories WHERE rule_id = $1', [ruleId]);
  if (!categoryIds?.length) return;
  const values = [ruleId];
  const placeholders = categoryIds.map((categoryId) => {
    values.push(categoryId);
    return `($1, $${values.length})`;
  });
  await query(
    `INSERT INTO pricing_rule_categories (rule_id, category_id) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
    values,
  );
}

export async function replaceRuleProducts(ruleId, productIds) {
  await query('DELETE FROM pricing_rule_products WHERE rule_id = $1', [ruleId]);
  if (!productIds?.length) return;
  const values = [ruleId];
  const placeholders = productIds.map((productId) => {
    values.push(productId);
    return `($1, $${values.length})`;
  });
  await query(
    `INSERT INTO pricing_rule_products (rule_id, product_id) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
    values,
  );
}

export async function replaceRuleStoneTypes(ruleId, stoneTypeIds) {
  await query('DELETE FROM pricing_rule_stone_types WHERE rule_id = $1', [ruleId]);
  if (!stoneTypeIds?.length) return;
  const values = [ruleId];
  const placeholders = stoneTypeIds.map((stoneTypeId) => {
    values.push(stoneTypeId);
    return `($1, $${values.length})`;
  });
  await query(
    `INSERT INTO pricing_rule_stone_types (rule_id, stone_type_id) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
    values,
  );
}

export async function replaceRulePurities(ruleId, purityValueIds) {
  await query('DELETE FROM pricing_rule_purities WHERE rule_id = $1', [ruleId]);
  if (!purityValueIds?.length) return;
  const values = [ruleId];
  const placeholders = purityValueIds.map((purityValueId) => {
    values.push(purityValueId);
    return `($1, $${values.length})`;
  });
  await query(
    `INSERT INTO pricing_rule_purities (rule_id, purity_value_id) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
    values,
  );
}

// conditions: [{ conditionType, stringValues, minValue, maxValue }]
export async function replaceRuleConditions(ruleId, conditions) {
  await query('DELETE FROM pricing_rule_conditions WHERE rule_id = $1', [ruleId]);
  if (!conditions?.length) return;
  const values = [ruleId];
  const placeholders = conditions.map((c) => {
    const start = values.length; // last index already used
    values.push(c.conditionType, c.stringValues ?? null, c.minValue ?? null, c.maxValue ?? null);
    return `($1, $${start + 1}, $${start + 2}, $${start + 3}, $${start + 4})`;
  });
  await query(
    `INSERT INTO pricing_rule_conditions (rule_id, condition_type, string_values, min_value, max_value)
     VALUES ${placeholders.join(', ')}`,
    values,
  );
}

export async function findRuleCategoryLinks(ruleIds) {
  if (ruleIds.length === 0) return [];
  const { rows } = await query(
    `SELECT rule_id, category_id FROM pricing_rule_categories WHERE rule_id = ANY($1)`,
    [ruleIds],
  );
  return rows;
}

export async function findRuleProductLinks(ruleIds) {
  if (ruleIds.length === 0) return [];
  const { rows } = await query(
    `SELECT rule_id, product_id FROM pricing_rule_products WHERE rule_id = ANY($1)`,
    [ruleIds],
  );
  return rows;
}

export async function findRuleStoneTypeLinks(ruleIds) {
  if (ruleIds.length === 0) return [];
  const { rows } = await query(
    `SELECT rule_id, stone_type_id FROM pricing_rule_stone_types WHERE rule_id = ANY($1)`,
    [ruleIds],
  );
  return rows;
}

export async function findRulePurityLinks(ruleIds) {
  if (ruleIds.length === 0) return [];
  const { rows } = await query(
    `SELECT rule_id, purity_value_id FROM pricing_rule_purities WHERE rule_id = ANY($1)`,
    [ruleIds],
  );
  return rows;
}

export async function findRuleConditions(ruleIds) {
  if (ruleIds.length === 0) return [];
  const { rows } = await query(
    `SELECT rule_id, condition_type, string_values, min_value, max_value
     FROM pricing_rule_conditions WHERE rule_id = ANY($1)`,
    [ruleIds],
  );
  return rows;
}

// Scope-resolution for the background repricing job (Phase 2) — kept here
// now since it's a natural companion to findLiveRules, even though nothing
// calls it until Phase 2's job exists. Descendant-inclusive, same recursive
// CTE shape as getCategoryAndDescendantIds (categories.repository.js).
export async function findProductIdsInRuleScope(rule) {
  if (rule.scope === 'PRODUCT') {
    const { rows } = await query(
      `SELECT p.id FROM products p
       JOIN pricing_rule_products prp ON prp.product_id = p.id AND prp.rule_id = $1
       WHERE p.is_price_locked = false`,
      [rule.id],
    );
    return rows.map((r) => r.id);
  }
  if (rule.scope === 'CATEGORY') {
    const { rows } = await query(
      `WITH RECURSIVE scoped AS (
         SELECT category_id AS id FROM pricing_rule_categories WHERE rule_id = $1
         UNION
         SELECT c.id FROM categories c JOIN scoped s ON c.parent_id = s.id
       )
       SELECT p.id FROM products p
       WHERE p.is_price_locked = false AND p.category_id IN (SELECT id FROM scoped)`,
      [rule.id],
    );
    return rows.map((r) => r.id);
  }
  // GLOBAL
  const { rows } = await query(`SELECT id FROM products WHERE is_price_locked = false`);
  return rows.map((r) => r.id);
}

const PREVIEW_COLUMNS = `
  p.id, p.sku, p.name, p.slug, p.category_id, p.purity, p.metal_type, p.is_price_locked,
  p.gold_value, p.stone_value, p.making_charge, p.gst_percent, p.selling_price, p.mrp,
  p.making_charge_discount_percent, p.stone_discount_percent
`;

// Same three scope shapes as findProductIdsInRuleScope, but (a) resolved
// from raw input arrays rather than persisted pricing_rule_categories/
// pricing_rule_products rows, so an unsaved rule can be simulated before
// it's ever written to the database, and (b) returns full preview rows
// INCLUDING price-locked products (unlike every other scope resolver in
// this file) — the Rule Preview endpoint needs to report "N excluded:
// price-locked" as its own reason, not just silently shrink the total.
export async function findScopeProductRowsForPreview({ scope, categoryIds, productIds }) {
  if (scope === 'PRODUCT') {
    if (!productIds?.length) return [];
    const { rows } = await query(`SELECT ${PREVIEW_COLUMNS} FROM products p WHERE p.id = ANY($1)`, [productIds]);
    return rows;
  }
  if (scope === 'CATEGORY') {
    if (!categoryIds?.length) return [];
    const { rows } = await query(
      `WITH RECURSIVE scoped AS (
         SELECT id FROM categories WHERE id = ANY($1)
         UNION
         SELECT c.id FROM categories c JOIN scoped s ON c.parent_id = s.id
       )
       SELECT ${PREVIEW_COLUMNS} FROM products p WHERE p.category_id IN (SELECT id FROM scoped)`,
      [categoryIds],
    );
    return rows;
  }
  const { rows } = await query(`SELECT ${PREVIEW_COLUMNS} FROM products p`);
  return rows;
}
