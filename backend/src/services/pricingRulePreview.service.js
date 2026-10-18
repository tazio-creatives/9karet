import { findScopeProductRowsForPreview } from '../repositories/pricingRules.repository.js';
import { findPurityPricingRuleValuesByProductIds } from '../repositories/purityPricingRules.repository.js';
import { findAllAttributesWithGlobalValues } from '../repositories/attributes.repository.js';
import { getCategoryAndAncestorIds } from '../repositories/categories.repository.js';
import { findStonesByProductIds } from '../repositories/productStones.repository.js';
import {
  loadActiveRuleSet,
  buildSyntheticRule,
  injectSyntheticRule,
  resolveMakingChargeDiscount,
  resolveStoneDiscount,
  stoneMatches,
  PREVIEW_RULE_ID,
} from './pricingRuleResolver.js';
import { computeSellingPrice, buildStoneComponents, round2 } from './pricingService.js';

const SAMPLE_LIMIT = 10;

// products.purity is a TEXT code ('9K'); pricing_rule_purities stores a
// UUID (attribute_values.id, the global Purity attribute's values) — same
// mapping product_purity_pricing_rules already relies on. Built once per
// preview call, not per product.
async function buildPurityValueIdByCode() {
  const attrs = await findAllAttributesWithGlobalValues();
  const purityAttr = attrs.find((a) => a.code === 'purity');
  const map = new Map();
  for (const v of purityAttr?.values ?? []) map.set(v.value, v.id);
  return map;
}

// Shared by both preview entry points (POST /rules/preview for an unsaved
// payload, POST /rules/:ruleId/preview for a saved one — the controller
// reconstructs the same `input` shape for a saved rule from its DB row +
// link tables before calling this) — never a parallel formula: this runs
// the exact same pricingRuleResolver functions computeVariantPricing itself
// uses, just against cached product columns instead of a live gold-rate
// recompute (a preview is an estimate; the real reprice job is what
// actually commits new prices).
export async function previewPricingRule(input) {
  const categoryIds = input.categoryIds ?? [];
  const productIds = input.productIds ?? [];

  const rows = await findScopeProductRowsForPreview({ scope: input.scope, categoryIds, productIds });
  const totalProductsInScope = rows.length;
  const eligibleRows = rows.filter((r) => !r.is_price_locked);
  const priceLockedCount = totalProductsInScope - eligibleRows.length;

  const purityValueIdByCode = await buildPurityValueIdByCode();
  const purityRulesByProduct = await findPurityPricingRuleValuesByProductIds(eligibleRows.map((r) => r.id));
  const stonesByProduct =
    input.ruleType === 'STONE' ? await findStonesByProductIds(eligibleRows.map((r) => r.id)) : new Map();

  const ancestorCache = new Map();
  async function ancestorsFor(categoryId) {
    if (!categoryId) return [];
    if (!ancestorCache.has(categoryId)) ancestorCache.set(categoryId, await getCategoryAndAncestorIds(categoryId));
    return ancestorCache.get(categoryId);
  }

  const baseRuleSet = await loadActiveRuleSet();
  const syntheticRule = buildSyntheticRule(input);
  const ruleSet = injectSyntheticRule(baseRuleSet, syntheticRule, { categoryIds, productIds });

  let matchingStoneCount = 0;
  let withExistingOverrides = 0;
  let willReceiveRule = 0;
  let clampedCount = 0;
  let suppressedCount = 0;
  let noMatchingStone = 0;
  const missingPricingData = [];
  const sampleCandidates = [];

  function gstOf(row, makingCharge, stoneValue) {
    return round2(
      computeSellingPrice({
        goldValue: Number(row.gold_value),
        stoneValue,
        makingCharge,
        gstPercent: Number(row.gst_percent),
      }) -
        Number(row.gold_value) -
        stoneValue -
        makingCharge,
    );
  }

  for (const row of eligibleRows) {
    const purityValueId = row.purity ? (purityValueIdByCode.get(row.purity) ?? null) : null;
    const purityRuleRow =
      (purityRulesByProduct.get(row.id) ?? []).find((r) => r.purity_value_id === purityValueId) ?? null;
    const categoryAncestorIds = await ancestorsFor(row.category_id);

    if (input.ruleType === 'MAKING_CHARGE') {
      const makingCharge = Number(row.making_charge);
      const hadOverride =
        purityRuleRow?.making_charge_discount_percent != null || Number(row.making_charge_discount_percent ?? 0) > 0;

      const result = resolveMakingChargeDiscount({
        product: row,
        categoryAncestorIds,
        purityValueId,
        purityRuleRow,
        ruleSet,
        makingCharge,
      });
      if (hadOverride) withExistingOverrides++;
      if (result.ruleId === PREVIEW_RULE_ID) {
        willReceiveRule++;
        if (result.clamped) clampedCount++;
        if (syntheticRule.override_mode === 'SUPPRESS' && hadOverride) suppressedCount++;
        {
          const afterMakingCharge = round2(makingCharge - result.amount);
          const stoneValue = Number(row.stone_value);
          sampleCandidates.push({
            productId: row.id,
            sku: row.sku,
            name: row.name,
            before: {
              makingCharge,
              stoneValue,
              gst: gstOf(row, makingCharge, stoneValue),
              sellingPrice: Number(row.selling_price),
            },
            after: {
              makingCharge: afterMakingCharge,
              stoneValue,
              gst: gstOf(row, afterMakingCharge, stoneValue),
              sellingPrice: computeSellingPrice({
                goldValue: Number(row.gold_value),
                stoneValue,
                makingCharge: afterMakingCharge,
                gstPercent: Number(row.gst_percent),
              }),
            },
          });
        }
      }
    } else {
      // STONE rule — a product with no stone line in the rule's scope (no
      // stones at all, or none of the selected stone types / carat range)
      // is simply out of scope for it, not "missing data".
      const components = buildStoneComponents(stonesByProduct.get(row.id) ?? []);
      if (!components.some((c) => stoneMatches(syntheticRule, c))) {
        noMatchingStone++;
        continue;
      }
      matchingStoneCount++;

      const hadOverride =
        purityRuleRow?.stone_discount_percent != null || Number(row.stone_discount_percent ?? 0) > 0;
      if (hadOverride) withExistingOverrides++;

      const results = components.map((component) =>
        resolveStoneDiscount({ product: row, categoryAncestorIds, purityRuleRow, ruleSet, component }),
      );
      const fromThisRule = results.filter((r) => r.ruleId === PREVIEW_RULE_ID);
      if (fromThisRule.length > 0) {
        willReceiveRule++;
        if (fromThisRule.some((r) => r.clamped)) clampedCount++;
        if (syntheticRule.override_mode === 'SUPPRESS' && hadOverride) suppressedCount++;

        const stoneValue = round2(components.reduce((sum, c) => sum + c.value, 0));
        const afterStoneValue = round2(
          components.reduce(
            (sum, c, i) => sum + (results[i].ruleId === PREVIEW_RULE_ID ? c.value - results[i].amount : c.value),
            0,
          ),
        );
        const makingCharge = Number(row.making_charge);
        sampleCandidates.push({
          productId: row.id,
          sku: row.sku,
          name: row.name,
          before: {
            makingCharge,
            stoneValue,
            gst: gstOf(row, makingCharge, stoneValue),
            sellingPrice: Number(row.selling_price),
          },
          after: {
            makingCharge,
            stoneValue: afterStoneValue,
            gst: gstOf(row, makingCharge, afterStoneValue),
            sellingPrice: computeSellingPrice({
              goldValue: Number(row.gold_value),
              stoneValue: afterStoneValue,
              makingCharge,
              gstPercent: Number(row.gst_percent),
            }),
          },
        });
      }
    }
  }

  // Every matching product is collected into sampleCandidates above, then
  // ranked here — highest current selling price first — and only the top
  // SAMPLE_LIMIT are actually returned. Without this, an admin previewing a
  // category with many still-unpriced draft products (₹0 before AND after —
  // correct, but uninformative) would see a sample table mostly full of
  // zeros instead of the products the rule actually matters for.
  const samples = sampleCandidates
    .slice()
    .sort((a, b) => b.before.sellingPrice - a.before.sellingPrice)
    .slice(0, SAMPLE_LIMIT);

  return {
    totalProductsInScope,
    eligibleCount: eligibleRows.length,
    matchingStoneCount: input.ruleType === 'STONE' ? matchingStoneCount : null,
    withExistingOverrides,
    willReceiveRule,
    clampedCount,
    suppressedCount: syntheticRule.override_mode === 'SUPPRESS' ? suppressedCount : 0,
    excluded: [
      { reason: 'PRICE_LOCKED', count: priceLockedCount },
      { reason: 'NO_MATCHING_STONE', count: noMatchingStone },
      { reason: 'MISSING_PRICING_DATA', count: missingPricingData.length },
    ].filter((e) => e.count > 0),
    missingPricingData: missingPricingData.slice(0, 20),
    samples,
  };
}
