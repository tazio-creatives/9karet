import { query } from '../config/db.js';
import { findExclusionPairsByProduct } from '../repositories/exclusionRules.repository.js';
import { findWeightRuleValuesByProduct } from '../repositories/weightRules.repository.js';

async function getAttributeIds() {
  const { rows } = await query('SELECT id, code FROM attributes');
  return Object.fromEntries(rows.map((r) => [r.code, r.id]));
}

// Resolves every value on one axis in a single query instead of one query
// per value (was the main N+1 source here — a product with 3 checked
// gold colours used to cost 3 round-trips just to resolve their ids).
async function globalValueIds(attributeId, values) {
  if (!values?.length) return new Map();
  const { rows } = await query(
    'SELECT id, value FROM attribute_values WHERE attribute_id = $1 AND product_id IS NULL AND value = ANY($2)',
    [attributeId, values],
  );
  return new Map(rows.map((r) => [r.value, r.id]));
}

function cartesian(lists) {
  return lists.reduce((acc, list) => acc.flatMap((combo) => list.map((item) => [...combo, item])), [[]]);
}

// product_weight_rules / product_purity_pricing_rules both FK their
// purity_value_id (and product_weight_rules its size_value_id) at the
// GLOBAL/product-scoped attribute_values row directly — not at
// product_attribute_values, the join table that actually tracks "what this
// product currently offers". Removing a purity or size from a product's
// selection therefore does NOT cascade-delete its weight/pricing rules on
// its own; call this right after product_attribute_values is resynced
// (syncProductVariants, or the axesChanged branch of adminUpdateProduct) to
// drop anything left referencing a purity/size the product no longer offers.
// A no-op for a brand-new product (nothing to prune yet) and safe to call
// even when the caller is about to fully replace these rules anyway (see
// productsService.js's applyWeightAndPricingRulesInTx) — replacement can
// only reference currently-offered values in the first place.
export async function pruneOrphanedPurityRules(productId) {
  await query(
    `DELETE FROM product_weight_rules r WHERE r.product_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM product_attribute_values pav
         WHERE pav.product_id = $1 AND pav.attribute_value_id = r.purity_value_id
       )`,
    [productId],
  );
  await query(
    `DELETE FROM product_weight_rules r WHERE r.product_id = $1 AND r.size_value_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM product_attribute_values pav
         WHERE pav.product_id = $1 AND pav.attribute_value_id = r.size_value_id
       )`,
    [productId],
  );
  await query(
    `DELETE FROM product_purity_pricing_rules r WHERE r.product_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM product_attribute_values pav
         WHERE pav.product_id = $1 AND pav.attribute_value_id = r.purity_value_id
       )`,
    [productId],
  );
}

// Re-evaluates every one of a product's variants against its current
// pairwise exclusion rules (Availability Rules in the admin) and keeps
// is_available in sync — a variant whose combination matches a rule is
// marked unavailable and tagged with which rule did it (excluded_by_rule_id)
// so this can be safely reverted later if the rule is removed or the
// combination changes, without ever touching a variant an admin excluded by
// hand (excluded_by_rule_id stays NULL for those, and this function never
// writes to one it didn't itself flag). Called both at the end of
// syncProductVariants (axes just changed) and directly whenever a rule is
// added/removed (axes didn't change, but availability might need to).
export async function applyExclusionRules(productId) {
  const rules = await findExclusionPairsByProduct(productId);
  const { rows: variants } = await query(
    `SELECT pv.id, pv.excluded_by_rule_id,
            array_remove(array_agg(vav.attribute_value_id), NULL) AS value_ids
     FROM product_variants pv
     LEFT JOIN variant_attribute_values vav ON vav.variant_id = pv.id
     WHERE pv.product_id = $1
     GROUP BY pv.id`,
    [productId],
  );

  // Grouped so each distinct rule needs one UPDATE covering every variant it
  // newly excludes, rather than one UPDATE per variant.
  const toExcludeByRule = new Map();
  const toRevert = [];

  for (const variant of variants) {
    const valueIds = variant.value_ids ?? [];
    const matchedRule = rules.find(
      (r) => valueIds.includes(r.attribute_value_id_a) && valueIds.includes(r.attribute_value_id_b),
    );

    if (matchedRule && variant.excluded_by_rule_id !== matchedRule.id) {
      if (!toExcludeByRule.has(matchedRule.id)) toExcludeByRule.set(matchedRule.id, []);
      toExcludeByRule.get(matchedRule.id).push(variant.id);
    } else if (!matchedRule && variant.excluded_by_rule_id != null) {
      toRevert.push(variant.id);
    }
  }

  for (const [ruleId, variantIds] of toExcludeByRule) {
    await query(
      'UPDATE product_variants SET is_available = false, excluded_by_rule_id = $2, updated_at = now() WHERE id = ANY($1)',
      [variantIds, ruleId],
    );
  }
  if (toRevert.length) {
    await query(
      'UPDATE product_variants SET is_available = true, excluded_by_rule_id = NULL, updated_at = now() WHERE id = ANY($1)',
      [toRevert],
    );
  }
}

// The Size row's "Stock" field on the product form only seeds stock for
// combinations it's creating for the first time (see syncProductVariants) —
// once a size's variants already exist, editing that field used to be a
// silent no-op, which read to an admin as "my save didn't work." This makes
// it actually apply: for each size the admin typed a *different* number
// into than what's currently there, every existing variant carrying that
// size (any Gold Colour combo) gets set to that same
// number — matching the old pre-variant-model mental model of "one stock
// count per size." Gated on an actual change (not just "a value is
// present") so an unrelated save — editing the description, say, with the
// Size rows left exactly as loaded — can never blast stock to a stale
// number; the "currently there" baseline must match what the admin's own
// form was pre-filled with (products.controller.js's toDetailDto uses the
// max across combos, not a sum — using a sum here instead used to make this
// comparison compare a sum against a single raw number, which is essentially
// never equal, so the UPDATE fired on every save and multiplied the stored
// value by the combo count each time: 1000 in with 28 sibling combos became
// 28000, then re-entering 1000 became 28000 again). A brand-new size (no
// existing variants yet) is skipped here — its variants don't exist yet, so
// the ordinary seed-at-creation path in syncProductVariants already gives
// them the right stock.
export async function applySizeStockUpdates(productId, sizesInput) {
  if (!sizesInput?.length) return;

  const { rows } = await query(
    `SELECT av.id AS size_value_id, av.value AS label,
            COALESCE(MAX(pv.stock_quantity) FILTER (WHERE pv.is_available), 0) AS current_stock
     FROM attribute_values av
     JOIN attributes a ON a.id = av.attribute_id AND a.code = 'size'
     LEFT JOIN variant_attribute_values vav ON vav.attribute_value_id = av.id
     LEFT JOIN product_variants pv ON pv.id = vav.variant_id AND pv.product_id = $1
     WHERE av.product_id = $1
     GROUP BY av.id, av.value`,
    [productId],
  );
  const currentByLabel = new Map(rows.map((r) => [r.label, { id: r.size_value_id, stock: Number(r.current_stock) }]));

  for (const s of sizesInput) {
    const current = currentByLabel.get(s.label);
    if (!current) continue; // brand-new size — nothing existing to update
    if (current.stock === s.stockQuantity) continue; // unchanged — no-op

    await query(
      `UPDATE product_variants SET stock_quantity = $2, updated_at = now()
       WHERE product_id = $1 AND id IN (
         SELECT variant_id FROM variant_attribute_values WHERE attribute_value_id = $3
       )`,
      [productId, s.stockQuantity, current.id],
    );
  }
}

// Keeps a product's product_attribute_values + product_variants rows in
// sync with its admin-configured Gold Colors / Purity / Sizes (Purity is
// always just 9K on 9Karet, passed by productsService). Existing variants
// for combinations that are still valid are left completely untouched unless
// `variantOverrides` explicitly targets them — preserves any stock/weight/
// availability the admin already set via the variant editor, otherwise.
// Variants for combinations no longer offered are removed (safe: order_items
// keeps its own label snapshot, only its product_variant_id goes null).
//
// variantOverrides (optional) lets the SAME save that creates the axes also
// set stock/weight/availability per exact combination in one request — the
// admin form's live matrix preview sends these so a brand-new product can be
// fully configured without a separate trip back into the variant editor.
// Each entry: { attributeValues: {goldColor?, purity?, sizeLabel?},
// stockQuantity?, goldWeightGrams?, isAvailable?, priceOverride? } — only
// the axes this product actually has configured need to be present.
export async function syncProductVariants(productId, { goldColors, purities, sizes, stockQuantity, variantOverrides }) {
  const attrByCode = await getAttributeIds();
  const axisLists = [];

  // Built alongside axisLists so variantOverrides can resolve the same
  // value ids without re-querying — value (or size label) ->
  // attribute_value id.
  const goldColorValueIds = new Map();
  const purityValueIds = new Map();
  const sizeValueIds = new Map();

  if (goldColors?.length) {
    const resolved = await globalValueIds(attrByCode.gold_color, goldColors);
    const entries = [];
    for (const color of goldColors) {
      const id = resolved.get(color);
      if (id) {
        entries.push({ attributeValueId: id });
        goldColorValueIds.set(color, id);
      }
    }
    if (entries.length) axisLists.push(entries);
  }

  if (purities?.length) {
    const resolved = await globalValueIds(attrByCode.purity, purities);
    const entries = [];
    for (const purity of purities) {
      const id = resolved.get(purity);
      if (id) {
        entries.push({ attributeValueId: id });
        purityValueIds.set(purity, id);
      }
    }
    if (entries.length) axisLists.push(entries);
  }

  if (sizes?.length) {
    // Product-scoped values, upserted individually since each can have a
    // different label/sort order — normally a handful of hand-entered rows,
    // not worth the complexity of a batched multi-row upsert.
    const entries = [];
    for (const [i, s] of sizes.entries()) {
      const { rows } = await query(
        `INSERT INTO attribute_values (attribute_id, product_id, value, label, sort_order)
         VALUES ($1, $2, $3, $3, $4)
         ON CONFLICT (attribute_id, product_id, value) WHERE product_id IS NOT NULL
           DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order
         RETURNING id`,
        [attrByCode.size, productId, s.label, i],
      );
      entries.push({ attributeValueId: rows[0].id, size: s });
      sizeValueIds.set(s.label, rows[0].id);
    }
    axisLists.push(entries);
  }

  const allValueIds = axisLists.flat().map((e) => e.attributeValueId);
  await query('DELETE FROM product_attribute_values WHERE product_id = $1', [productId]);
  if (allValueIds.length) {
    const values = allValueIds.map((_, i) => `($1, $${i + 2})`).join(', ');
    await query(
      `INSERT INTO product_attribute_values (product_id, attribute_value_id) VALUES ${values} ON CONFLICT DO NOTHING`,
      [productId, ...allValueIds],
    );
  }

  // Resolves one override's {goldColor, purity, sizeLabel}
  // to the combination_key a generated variant would have — same sorted-join
  // shape used everywhere else. Returns null if any specified axis value
  // doesn't actually resolve (e.g. a stale/unconfigured value), so a bad
  // override is silently skipped rather than corrupting an unrelated variant.
  function resolveOverrideKey(attributeValues = {}) {
    const ids = [];
    if (attributeValues.goldColor) {
      const id = goldColorValueIds.get(attributeValues.goldColor);
      if (!id) return null;
      ids.push(id);
    }
    if (attributeValues.purity) {
      const id = purityValueIds.get(attributeValues.purity);
      if (!id) return null;
      ids.push(id);
    }
    if (attributeValues.sizeLabel) {
      const id = sizeValueIds.get(attributeValues.sizeLabel);
      if (!id) return null;
      ids.push(id);
    }
    return ids.sort().join('|');
  }

  // variantsByKey: combination_key -> variant id, built once by the caller
  // (from the same existing-variants read it already needed for stale-combo
  // cleanup) so this doesn't re-query per override.
  async function applyOverrides(variantsByKey) {
    if (!variantOverrides?.length) return;
    for (const override of variantOverrides) {
      const key = resolveOverrideKey(override.attributeValues);
      if (key === null) continue;
      const variantId = variantsByKey.get(key);
      if (!variantId) continue;

      const values = [variantId];
      const setClauses = [];
      const fieldMap = {
        stockQuantity: 'stock_quantity',
        goldWeightGrams: 'gold_weight_grams',
        isAvailable: 'is_available',
        priceOverride: 'price_override',
      };
      for (const [key2, column] of Object.entries(fieldMap)) {
        if (Object.hasOwn(override, key2)) {
          values.push(override[key2]);
          setClauses.push(`${column} = $${values.length}`);
        }
      }
      if (setClauses.length === 0) continue;
      setClauses.push('updated_at = now()');
      // An admin explicitly setting availability in an override is deliberate
      // intent — it wins over an Availability Rule that would otherwise
      // exclude this exact combination, and un-tags it as rule-driven so a
      // later rule re-sync doesn't fight it back the other way.
      if (Object.hasOwn(override, 'isAvailable')) {
        setClauses.push('excluded_by_rule_id = NULL');
      }
      await query(`UPDATE product_variants SET ${setClauses.join(', ')} WHERE id = $1`, values);
    }
  }

  if (axisLists.length === 0) {
    // No configured axes — exactly one synthetic default variant, kept in
    // sync with the product's own flat stockQuantity (unchanged behavior
    // for the common "simple product, no variation" case).
    await query('DELETE FROM product_variants WHERE product_id = $1 AND combination_key != $2', [productId, '']);
    const { rows } = await query(
      'SELECT id FROM product_variants WHERE product_id = $1 AND combination_key = $2',
      [productId, ''],
    );
    if (rows[0]) {
      await query('UPDATE product_variants SET stock_quantity = $2 WHERE id = $1', [rows[0].id, stockQuantity ?? 0]);
    } else {
      await query(
        `INSERT INTO product_variants (product_id, stock_quantity, combination_key) VALUES ($1, $2, '')`,
        [productId, stockQuantity ?? 0],
      );
    }
    return;
  }

  const combos = cartesian(axisLists);
  const validKeys = new Set(combos.map((combo) => combo.map((c) => c.attributeValueId).sort().join('|')));

  // Weight Defaults rules (exact Purity+Size, then Purity-only) take
  // priority when seeding a newly-created variant's weight, matching
  // computeVariantPricing's own resolution order; the Size row's "Gold
  // Weight (g)" field is only consulted as a fallback when no rule covers
  // it.
  const purityIdSet = new Set(purityValueIds.values());
  const weightRulesForSeeding = await findWeightRuleValuesByProduct(productId);
  function resolveSeedWeightFromRules(purityId, sizeId) {
    if (purityId == null) return null;
    const puritySizeRule =
      sizeId != null
        ? weightRulesForSeeding.find((r) => r.purity_value_id === purityId && r.size_value_id === sizeId)
        : null;
    const purityRule = weightRulesForSeeding.find((r) => r.purity_value_id === purityId && r.size_value_id === null);
    const matched = puritySizeRule ?? purityRule;
    if (matched == null) return null;
    const weight = Number(matched.gold_weight_grams);
    return Number.isFinite(weight) && weight > 0 ? weight : null;
  }

  // One query for "what already exists", reused for both the
  // already-real-combination skip below and the stale-combination cleanup
  // afterward — was one SELECT per combination before.
  const { rows: existingVariants } = await query(
    'SELECT id, combination_key FROM product_variants WHERE product_id = $1',
    [productId],
  );
  const existingByKey = new Map(existingVariants.map((v) => [v.combination_key, v.id]));

  for (const [i, combo] of combos.entries()) {
    const valueIds = combo.map((c) => c.attributeValueId).sort();
    const combinationKey = valueIds.join('|');
    if (existingByKey.has(combinationKey)) continue; // already exists — leave the admin's own overrides untouched

    const sizeEntry = combo.find((c) => c.size);
    const purityId = combo.map((c) => c.attributeValueId).find((id) => purityIdSet.has(id)) ?? null;
    const sizeId = sizeEntry ? sizeEntry.attributeValueId : null;
    const ruleWeightGrams = resolveSeedWeightFromRules(purityId, sizeId);
    const goldWeightGrams = ruleWeightGrams ?? (sizeEntry ? (sizeEntry.size.weightGrams ?? null) : null);
    // A size row carries its own stock; any other new combination starts
    // at the form's Default Stock ("new combinations inherit these values").
    const seedStock = sizeEntry ? (sizeEntry.size.stockQuantity ?? 0) : (stockQuantity ?? 0);

    const { rows: inserted } = await query(
      `INSERT INTO product_variants
         (product_id, gold_weight_grams, stock_quantity, combination_key, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [productId, goldWeightGrams, seedStock, combinationKey, i],
    );
    const newVariantId = inserted[0].id;
    existingByKey.set(combinationKey, newVariantId);

    const vavValues = valueIds.map((_, vi) => `($1, $${vi + 2})`).join(', ');
    await query(
      `INSERT INTO variant_attribute_values (variant_id, attribute_value_id) VALUES ${vavValues}`,
      [newVariantId, ...valueIds],
    );
  }

  for (const v of existingVariants) {
    if (!validKeys.has(v.combination_key)) {
      // Covers both stale real combinations and the synthetic default
      // (empty key) once real axes exist.
      await query('DELETE FROM product_variants WHERE id = $1', [v.id]);
      existingByKey.delete(v.combination_key);
    }
  }

  // Every 9Karet product carries the one 9K purity, so a product with no
  // gold colours or sizes has exactly one real variant instead of the
  // synthetic default — keep its stock in sync with the product's own
  // stockQuantity the same way the default variant is (above).
  if (combos.length === 1 && !sizes?.length && !goldColors?.length && stockQuantity != null) {
    await query('UPDATE product_variants SET stock_quantity = $2 WHERE product_id = $1', [productId, stockQuantity]);
  }

  await applyExclusionRules(productId);
  await applyOverrides(existingByKey);
}
