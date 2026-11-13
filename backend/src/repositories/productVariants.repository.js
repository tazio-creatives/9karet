import { query } from '../config/db.js';

// One row per variant, with all its resolved attribute values folded into a
// single `attributes` JSON object keyed by attribute code — e.g.
// { purity: {valueId, value: '9K', label: '9K', refId: null},
//   gold_color: {valueId, value: 'ROSE', label: 'Rose Gold', refId: null},
//   size: {valueId, value: '6', label: '6', refId: null} }
// Only axes actually configured for that variant appear as keys.
const VARIANT_WITH_ATTRIBUTES_SELECT = `
  SELECT pv.*,
    COALESCE(
      json_object_agg(a.code, jsonb_build_object('valueId', av.id, 'value', av.value, 'label', av.label, 'refId', av.ref_id))
        FILTER (WHERE a.code IS NOT NULL),
      '{}'::json
    ) AS attributes
  FROM product_variants pv
  LEFT JOIN variant_attribute_values vav ON vav.variant_id = pv.id
  LEFT JOIN attribute_values av ON av.id = vav.attribute_value_id
  LEFT JOIN attributes a ON a.id = av.attribute_id
`;

export async function findVariantsByProductId(productId) {
  const { rows } = await query(
    `${VARIANT_WITH_ATTRIBUTES_SELECT} WHERE pv.product_id = $1 GROUP BY pv.id ORDER BY pv.sort_order`,
    [productId],
  );
  return rows;
}

export async function findVariantById(id) {
  const { rows } = await query(`${VARIANT_WITH_ATTRIBUTES_SELECT} WHERE pv.id = $1 GROUP BY pv.id`, [id]);
  return rows[0] ?? null;
}

export async function findAvailableVariantsByProductId(productId) {
  const { rows } = await query(
    `${VARIANT_WITH_ATTRIBUTES_SELECT} WHERE pv.product_id = $1 AND pv.is_available = true GROUP BY pv.id ORDER BY pv.sort_order`,
    [productId],
  );
  return rows;
}

// Resolved-value helpers — a variant with no value on that axis falls back
// to the product's own base value (handled by the caller, not here).
export function resolvedPurity(variant) {
  return variant?.attributes?.purity?.value ?? null;
}
export function resolvedGoldColor(variant) {
  return variant?.attributes?.gold_color?.value ?? null;
}
export function resolvedSizeLabel(variant) {
  return variant?.attributes?.size?.label ?? null;
}
export function attributeValueIds(variant) {
  return Object.values(variant?.attributes ?? {}).map((a) => a.valueId);
}

// Attribute + values catalogue for a product — what's offered on each axis
// (product_attribute_values), used to render selectors and generate the
// admin's variant matrix. Global values (Purity/Gold Color)
// and product-scoped values (Size) are both included transparently.
export async function findProductAttributeCatalogue(productId) {
  const { rows } = await query(
    `SELECT a.code, a.name, a.sort_order AS attribute_sort_order,
            av.id AS value_id, av.value, av.label, av.ref_id, av.sort_order AS value_sort_order
     FROM product_attribute_values pav
     JOIN attribute_values av ON av.id = pav.attribute_value_id
     JOIN attributes a ON a.id = av.attribute_id
     WHERE pav.product_id = $1 AND av.is_active = true
     ORDER BY a.sort_order, av.sort_order`,
    [productId],
  );
  const byCode = new Map();
  for (const row of rows) {
    if (!byCode.has(row.code)) {
      byCode.set(row.code, { code: row.code, name: row.name, values: [] });
    }
    byCode.get(row.code).values.push({ id: row.value_id, value: row.value, label: row.label, refId: row.ref_id });
  }
  return [...byCode.values()];
}

export async function replaceProductAttributeValues(productId, attributeValueIds) {
  await query('DELETE FROM product_attribute_values WHERE product_id = $1', [productId]);
  if (!attributeValueIds?.length) return;
  const values = attributeValueIds.map((_, i) => `($1, $${i + 2}, ${i})`).join(', ');
  await query(
    `INSERT INTO product_attribute_values (product_id, attribute_value_id, sort_order) VALUES ${values}`,
    [productId, ...attributeValueIds],
  );
}

export async function createOrUpdateSizeValue(productId, sizeAttrId, label, sortOrder) {
  const { rows } = await query(
    `INSERT INTO attribute_values (attribute_id, product_id, value, label, sort_order)
     VALUES ($1, $2, $3, $3, $4)
     ON CONFLICT (attribute_id, product_id, value) WHERE product_id IS NOT NULL
       DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order
     RETURNING id`,
    [sizeAttrId, productId, label, sortOrder],
  );
  return rows[0].id;
}

export async function upsertVariant(
  productId,
  { id, attributeValueIds: valueIds, goldWeightGrams, stockQuantity, isAvailable, sortOrder, sku },
) {
  const combinationKey = [...valueIds].sort().join('|');

  if (id) {
    await query(
      `UPDATE product_variants
       SET gold_weight_grams = $2, stock_quantity = $3, is_available = $4, sort_order = $5, sku = $6,
           combination_key = $7, updated_at = now()
       WHERE id = $1 AND product_id = $8`,
      [id, goldWeightGrams, stockQuantity, isAvailable, sortOrder, sku, combinationKey, productId],
    );
    await query('DELETE FROM variant_attribute_values WHERE variant_id = $1', [id]);
    for (const valueId of valueIds) {
      await query('INSERT INTO variant_attribute_values (variant_id, attribute_value_id) VALUES ($1, $2)', [id, valueId]);
    }
    return id;
  }

  const { rows } = await query(
    `INSERT INTO product_variants
       (product_id, gold_weight_grams, stock_quantity, is_available, sort_order, sku, combination_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [productId, goldWeightGrams, stockQuantity, isAvailable ?? true, sortOrder ?? 0, sku ?? null, combinationKey],
  );
  const variantId = rows[0].id;
  for (const valueId of valueIds) {
    await query('INSERT INTO variant_attribute_values (variant_id, attribute_value_id) VALUES ($1, $2)', [variantId, valueId]);
  }
  return variantId;
}

// Partial update for the admin variant editor — stock/weight/availability
// only, never touches attribute links or combination_key (those only change
// via upsertVariant/syncProductVariants, which regenerate the matrix itself).
const VARIANT_FIELD_MAP = {
  stockQuantity: 'stock_quantity',
  goldWeightGrams: 'gold_weight_grams',
  isAvailable: 'is_available',
  sku: 'sku',
  priceOverride: 'price_override',
};

function buildFieldUpdate(fields, startIndex) {
  const values = [];
  const setClauses = [];
  for (const [key, column] of Object.entries(VARIANT_FIELD_MAP)) {
    if (Object.hasOwn(fields, key)) {
      values.push(fields[key]);
      setClauses.push(`${column} = $${startIndex + values.length}`);
    }
  }
  return { values, setClauses };
}

export async function updateVariantFields(productId, variantId, fields) {
  const { values, setClauses } = buildFieldUpdate(fields, 2);
  if (setClauses.length === 0) return findVariantById(variantId);
  setClauses.push('updated_at = now()');
  // Same reasoning as the variantOverrides path: an admin manually toggling
  // Available on one row here is deliberate — it wins over an Availability
  // Rule and un-tags this variant as rule-driven, so a later rule change
  // doesn't silently flip it back.
  if (Object.hasOwn(fields, 'isAvailable')) {
    setClauses.push('excluded_by_rule_id = NULL');
  }
  await query(
    `UPDATE product_variants SET ${setClauses.join(', ')} WHERE id = $1 AND product_id = $2`,
    [variantId, productId, ...values],
  );
  return findVariantById(variantId);
}

// Same field set applied to many variants at once — the bulk-edit toolbar.
// "Reset to inherited" is just this called with
// { goldWeightGrams: null, priceOverride: null } — no separate code path
// needed.
export async function bulkUpdateVariantFields(productId, variantIds, fields) {
  const { values, setClauses } = buildFieldUpdate(fields, 2);
  if (setClauses.length === 0 || variantIds.length === 0) return [];
  setClauses.push('updated_at = now()');
  if (Object.hasOwn(fields, 'isAvailable')) {
    setClauses.push('excluded_by_rule_id = NULL');
  }
  await query(
    `UPDATE product_variants SET ${setClauses.join(', ')} WHERE product_id = $1 AND id = ANY($2) `,
    [productId, variantIds, ...values],
  );
  const { rows } = await query(
    `${VARIANT_WITH_ATTRIBUTES_SELECT} WHERE pv.product_id = $1 AND pv.id = ANY($2) GROUP BY pv.id ORDER BY pv.sort_order`,
    [productId, variantIds],
  );
  return rows;
}

export async function deleteVariant(productId, variantId) {
  await query('DELETE FROM product_variants WHERE id = $1 AND product_id = $2', [variantId, productId]);
}

export async function ensureDefaultVariant(productId, stockQuantity) {
  const { rows } = await query(
    `SELECT id FROM product_variants WHERE product_id = $1 AND combination_key = ''`,
    [productId],
  );
  if (rows[0]) return rows[0].id;
  const { rows: inserted } = await query(
    `INSERT INTO product_variants (product_id, stock_quantity, combination_key) VALUES ($1, $2, '') RETURNING id`,
    [productId, stockQuantity ?? 0],
  );
  return inserted[0].id;
}
