import { AppError } from '../utils/AppError.js';
import { getCurrentGoldRate, getCurrentGoldRates } from '../repositories/goldRates.repository.js';
import { resolvedPurity, resolvedGoldColor, resolvedSizeLabel } from '../repositories/productVariants.repository.js';
import { findWeightRuleValuesByProduct } from '../repositories/weightRules.repository.js';
import { findPurityPricingRuleValuesByProduct } from '../repositories/purityPricingRules.repository.js';
import { findStonesByProductId } from '../repositories/productStones.repository.js';
import { getCategoryAndAncestorIds } from '../repositories/categories.repository.js';
import { resolveMakingChargeDiscount, resolveStoneDiscount } from './pricingRuleResolver.js';

// karat/24 purity multiplier. 9Karet sells 9K only; 24K is kept alongside it
// as the market reference rate the live feed quotes and the admin sees.
const PURITY_KARATS = { '9K': 9, '24K': 24 };

export function deriveRatesFromBase24k(rate24k) {
  return Object.entries(PURITY_KARATS).map(([purity, karat]) => ({
    purity,
    ratePerGram: Math.round(((rate24k * karat) / 24) * 100) / 100,
  }));
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export async function computeGoldValue(netWeightGrams, purity) {
  const rate = await getCurrentGoldRate(purity);
  if (!rate) throw new AppError(409, `No gold rate available yet for purity ${purity}`);
  return {
    goldValue: round2(netWeightGrams * Number(rate.rate_per_gram)),
    goldRateId: rate.id,
    goldRatePerGram: Number(rate.rate_per_gram),
  };
}

// Stones are priced by hand per product line (weight + price entered in the
// admin), so a product's stone value is simply the sum of its lines' prices
// — it never moves with the gold rate.
export function computeStoneValue(stones) {
  return round2((stones ?? []).reduce((sum, s) => sum + Number(s.price), 0));
}

export function computeStoneWeightCarats(stones) {
  if (!stones?.length) return null;
  return Math.round(stones.reduce((sum, s) => sum + Number(s.weight_carats ?? s.weightCarats), 0) * 1000) / 1000;
}

// selling_price = gold + stones + making + GST-on-that-subtotal.
export function computeSellingPrice({ goldValue, stoneValue, makingCharge, gstPercent }) {
  const subtotal = goldValue + stoneValue + makingCharge;
  const gstAmount = subtotal * (gstPercent / 100);
  return round2(subtotal + gstAmount);
}

// A per-product promotional offer — a live % discount on Making Charge
// and/or Stone Value, recomputed through the same formula as everything
// else (so it's never out of sync with the actual gold rate). Deliberately a
// no-op when no discount is configured (the overwhelming common case): a
// product's admin-set sellingPrice stays exactly as entered, "final,
// admin-overridable", untouched — only once an offer is actually set does
// the total recompute from the discounted components, becoming the real
// charged price everywhere this flows (PDP, listing cards, cart, checkout).
export function applyProductOffer({
  goldValue,
  stoneValue,
  makingCharge,
  gstPercent,
  sellingPrice,
  makingChargeDiscountPercent,
  stoneDiscountPercent,
}) {
  const hasOffer = (makingChargeDiscountPercent ?? 0) > 0 || (stoneDiscountPercent ?? 0) > 0;
  if (!hasOffer) {
    return {
      goldValue,
      stoneValue,
      stoneValueOriginal: stoneValue,
      makingCharge,
      makingChargeOriginal: makingCharge,
      makingChargeDiscountPercent: 0,
      stoneDiscountPercent: 0,
      sellingPrice,
      sellingPriceOriginal: sellingPrice,
    };
  }

  const discountedMakingCharge = round2(makingCharge * (1 - (makingChargeDiscountPercent ?? 0) / 100));
  const discountedStoneValue = round2(stoneValue * (1 - (stoneDiscountPercent ?? 0) / 100));
  const discountedSellingPrice = computeSellingPrice({
    goldValue,
    stoneValue: discountedStoneValue,
    makingCharge: discountedMakingCharge,
    gstPercent,
  });

  return {
    goldValue,
    stoneValue: discountedStoneValue,
    stoneValueOriginal: stoneValue,
    makingCharge: discountedMakingCharge,
    makingChargeOriginal: makingCharge,
    makingChargeDiscountPercent: makingChargeDiscountPercent ?? 0,
    stoneDiscountPercent: stoneDiscountPercent ?? 0,
    sellingPrice: discountedSellingPrice,
    sellingPriceOriginal: sellingPrice,
  };
}

// One pricing component per product_stones line — what stone discount
// rules resolve against (each line can match a different rule by its stone
// type / carat weight).
export function buildStoneComponents(stones) {
  return (stones ?? []).map((s) => ({
    stoneId: s.id,
    stoneTypeId: s.stone_type_id,
    stoneTypeName: s.stone_type_name ?? null,
    count: s.stone_count,
    carats: Number(s.weight_carats),
    value: round2(Number(s.price)),
  }));
}

function undiscountedComponents(components) {
  return components.map((c) => ({
    ...c,
    finalValue: c.value,
    discountAmount: 0,
    discountPercent: 0,
    appliedRuleId: null,
    appliedRuleName: null,
    source: 'NONE',
    clamped: false,
  }));
}

// Amount-first sibling of applyProductOffer, used only when an actual
// PRODUCT/CATEGORY/GLOBAL pricing_rules row won the resolution for making
// charge and/or at least one stone component (see computeVariantPricing).
// Still calls the same single computeSellingPrice — GST is still computed
// once, after discounts, on the summed subtotal, never a second formula.
// `makingChargeDiscount` and each component's `.discount` are the {amount,
// percent, ruleId, ruleName, source, clamped} shape pricingRuleResolver.js
// returns.
export function applyResolvedDiscounts({
  goldValue,
  makingCharge,
  gstPercent,
  sellingPrice,
  makingChargeDiscount,
  stoneComponents,
}) {
  const discountedMakingCharge = round2(makingCharge - makingChargeDiscount.amount);
  const stoneValueOriginal = round2(stoneComponents.reduce((sum, c) => sum + c.value, 0));

  const resolvedComponents = stoneComponents.map((c) => {
    const { discount, ...component } = c;
    return {
      ...component,
      finalValue: round2(c.value - discount.amount),
      discountAmount: discount.amount,
      discountPercent: discount.percent,
      appliedRuleId: discount.ruleId,
      appliedRuleName: discount.ruleName,
      source: discount.source,
      clamped: discount.clamped,
    };
  });
  const discountedStoneValue = round2(resolvedComponents.reduce((sum, c) => sum + c.finalValue, 0));

  const discountedSellingPrice = computeSellingPrice({
    goldValue,
    stoneValue: discountedStoneValue,
    makingCharge: discountedMakingCharge,
    gstPercent,
  });

  return {
    goldValue,
    stoneValue: discountedStoneValue,
    stoneValueOriginal,
    makingCharge: discountedMakingCharge,
    makingChargeOriginal: makingCharge,
    makingChargeDiscountPercent: makingChargeDiscount.percent,
    stoneDiscountPercent:
      stoneValueOriginal > 0 ? round2(((stoneValueOriginal - discountedStoneValue) / stoneValueOriginal) * 100) : 0,
    sellingPrice: discountedSellingPrice,
    sellingPriceOriginal: sellingPrice,
    stoneComponents: resolvedComponents,
  };
}

// Admin product form's live price preview — what the base configuration
// would sell for with the weight/stones/making charge currently typed in,
// before the product is saved.
export async function previewPricing({ goldWeightGrams, stones = [], makingCharge = 0, gstPercent = 3 }) {
  const goldValue = goldWeightGrams ? (await computeGoldValue(goldWeightGrams, '9K')).goldValue : 0;
  const stoneValue = computeStoneValue(stones);
  const sellingPrice = computeSellingPrice({ goldValue, stoneValue, makingCharge, gstPercent });

  return { goldValue, stoneValue, makingCharge, gstPercent, sellingPrice };
}

export function getCurrentRatesSnapshot() {
  return getCurrentGoldRates();
}

// Resolves a variant's gold weight against Weight Defaults: an exact
// Product+Purity+Size rule (most specific) beats a Purity-only rule;
// returns null if neither matches, so the caller can fall through to its
// own legacy levels. A matched row's weight is still validated explicitly
// (finite, > 0) rather than trusted blindly — the DB's CHECK constraint
// already guarantees this for anything that made it into the table, but a
// row is data, not a type guarantee.
async function resolveWeightFromRules(product, variant, weightRules) {
  const purityValueId = variant?.attributes?.purity?.valueId ?? null;
  const sizeValueId = variant?.attributes?.size?.valueId ?? null;
  if (purityValueId == null) return null;

  const rules = weightRules ?? (await findWeightRuleValuesByProduct(product.id));
  const puritySizeRule = sizeValueId
    ? rules.find((r) => r.purity_value_id === purityValueId && r.size_value_id === sizeValueId)
    : null;
  const purityRule = rules.find((r) => r.purity_value_id === purityValueId && r.size_value_id === null);
  const matched = puritySizeRule ?? purityRule;
  if (matched == null) return null;

  const weight = Number(matched.gold_weight_grams);
  return Number.isFinite(weight) && weight > 0 ? weight : null;
}

function numOrNull(v) {
  return v == null ? null : Number(v);
}

// Resolves a variant's Product+Purity pricing rule row (or null — total
// inheritance) from a pre-fetched array, or fetches on demand when none was
// passed (same "optional, fetched only when actually needed" contract as
// resolveWeightFromRules above).
async function resolvePurityPricingRuleRow(product, variant, purityPricingRules) {
  const purityValueId = variant?.attributes?.purity?.valueId ?? null;
  if (purityValueId == null) return null;
  const rules = purityPricingRules ?? (await findPurityPricingRuleValuesByProduct(product.id));
  return rules.find((r) => r.purity_value_id === purityValueId) ?? null;
}

// Resolves each of the three charge/discount fields independently: a
// purity rule's own value wins if set, otherwise the product-level default,
// otherwise (discounts only) 0. Uses `??` throughout, never `||` — 0 is a
// valid, explicit override or default and must never be treated as "unset".
// makingChargePercent has no final `?? 0` fallback: null here means "no
// percent configured at all, anywhere" — computeVariantPricing's own
// fallback to the flat `making_charge` column is what handles that case,
// not a fabricated 0% rate.
export function resolvePurityPricingFields(product, purityRule) {
  const makingChargePercent = numOrNull(purityRule?.making_charge_percent) ?? numOrNull(product.making_charge_percent);
  const makingChargeDiscountPercent =
    numOrNull(purityRule?.making_charge_discount_percent) ?? numOrNull(product.making_charge_discount_percent) ?? 0;
  const stoneDiscountPercent =
    numOrNull(purityRule?.stone_discount_percent) ?? numOrNull(product.stone_discount_percent) ?? 0;
  return { makingChargePercent, makingChargeDiscountPercent, stoneDiscountPercent };
}

// Prices a product's line for a specific product_variants row (or the
// synthetic default variant with no attribute values / overrides, for a
// product with nothing configured). Every axis is resolved generically from
// the variant's own attribute values and weight overrides, falling back to
// the product's base value on any axis the variant doesn't override.
//
// `weightRules` and `purityPricingRules` are both optional — pass a
// pre-fetched array (from findWeightRuleValuesByProduct /
// findPurityPricingRuleValuesByProduct) when pricing many variants for the
// same product in a loop (adminListVariants, adminBulkUpdateVariants) to
// avoid re-querying per variant; omitted, each is fetched on demand only
// when actually needed (the variant carries a purity at all).
//
// Stones are product-level (every variant carries the same stones). They're
// read from `product.stones` when the caller already attached them (tests,
// batch paths), otherwise fetched here.
//
// `ruleSet` (from pricingRuleResolver.loadActiveRuleSet) is optional:
// omitted, only the product's own flat/purity offer percentages apply.
// Passed, a PRODUCT/CATEGORY/GLOBAL pricing_rules row that resolves for the
// product (making charge) or a stone line takes over; with no such rule this
// still falls back to the exact applyProductOffer arithmetic.
export async function computeVariantPricing(product, variant = null, weightRules = null, purityPricingRules = null, ruleSet = null) {
  const effectivePurity = resolvedPurity(variant) || product.purity;
  const effectiveGoldColor = resolvedGoldColor(variant) || product.gold_color;

  // Priority: an exact Product+Purity+Size (or Purity-only) Weight Defaults
  // rule is the source of truth and is always checked first — it must be
  // able to override a variant's own historical weight, not just fill a gap
  // left by it. A variant's own gold_weight_grams is only a fallback for
  // products that never adopted Weight Defaults; the product's own base
  // weight remains the final fallback. Uses ?? throughout, not ||, since a
  // resolved weight is a validated number, not something to be re-tested
  // for truthiness.
  const baseWeightGrams = product.gold_weight_grams != null ? Number(product.gold_weight_grams) : null;
  const legacyVariantWeightGrams = variant?.gold_weight_grams != null ? Number(variant.gold_weight_grams) : null;
  const ruleWeightGrams = variant != null ? await resolveWeightFromRules(product, variant, weightRules) : null;
  const variantWeightGrams = ruleWeightGrams ?? legacyVariantWeightGrams;
  const effectiveWeightGrams = variantWeightGrams ?? baseWeightGrams;
  const weightOverridden =
    variantWeightGrams != null && baseWeightGrams != null && variantWeightGrams !== baseWeightGrams;

  // Recomputed live whenever a real variant is being priced — never trust
  // the cached product.gold_value here, since applyBaseProductPricing caches
  // the *base* configuration's price onto that same column, which is not
  // necessarily this variant even when its own weight/purity happen to equal
  // the product's base fields. Only the true no-variant case (variant ===
  // null) falls back to the cached column.
  let goldValue = Number(product.gold_value);
  let goldRatePerGram = null;
  if (
    effectiveWeightGrams != null &&
    (variant != null || weightOverridden || (effectivePurity && effectivePurity !== product.purity))
  ) {
    const goldResult = await computeGoldValue(effectiveWeightGrams, effectivePurity);
    goldValue = goldResult.goldValue;
    goldRatePerGram = goldResult.goldRatePerGram;
  }

  const stones = product.stones ?? (await findStonesByProductId(product.id));
  const stoneValue = computeStoneValue(stones);
  const stoneWeightCarats = computeStoneWeightCarats(stones);
  const stoneComponentsRaw = buildStoneComponents(stones);

  // Making charge is a live % of gold value when a percent is configured —
  // scales automatically with goldValue above, so it's already correct for
  // whatever size was just resolved. A Product+Purity pricing rule
  // (product_purity_pricing_rules) is checked first, per field, falling back
  // to the product-level default; falls back further to the flat
  // making_charge column for products with no % set anywhere, or with no
  // gold value at all (a % of ₹0 is meaningless, so those stay on an
  // admin-entered flat ₹ amount).
  const purityPricingRule =
    variant != null ? await resolvePurityPricingRuleRow(product, variant, purityPricingRules) : null;
  const { makingChargePercent, makingChargeDiscountPercent, stoneDiscountPercent } = resolvePurityPricingFields(
    product,
    purityPricingRule,
  );
  const makingCharge =
    makingChargePercent != null && goldValue > 0
      ? round2(goldValue * (makingChargePercent / 100))
      : Number(product.making_charge);
  const gstPercent = Number(product.gst_percent);
  const baseSellingPrice = computeSellingPrice({ goldValue, stoneValue, makingCharge, gstPercent });

  const shared = {
    purity: effectivePurity,
    sizeLabel: resolvedSizeLabel(variant),
    goldColor: effectiveGoldColor,
    goldWeightGrams: effectiveWeightGrams,
    goldRatePerGram,
    stoneWeightCarats,
    gstPercent,
  };

  // A per-variant manual price override wins outright — set by an admin for
  // this one exact combination, it replaces the live-computed total. The
  // component breakdown (goldValue/stoneValue/makingCharge) above is kept
  // as computed for informational display; only the final total changes.
  // Product-level promotional offers don't layer on top of a manual
  // override — the override *is* the final admin-set price.
  if (variant?.price_override != null) {
    const overridePrice = round2(Number(variant.price_override));
    return {
      ...shared,
      goldValue,
      stoneValue,
      stoneValueOriginal: stoneValue,
      makingCharge,
      makingChargeOriginal: makingCharge,
      makingChargeDiscountPercent: 0,
      stoneDiscountPercent: 0,
      makingChargeDiscountAmount: 0,
      appliedMakingChargeRuleId: null,
      appliedMakingChargeRuleName: null,
      makingChargeDiscountSource: 'NONE',
      stoneDiscountAmount: 0,
      stoneComponents: undiscountedComponents(stoneComponentsRaw),
      gstAmount: round2(overridePrice - goldValue - stoneValue - makingCharge),
      sellingPrice: overridePrice,
      sellingPriceOriginal: overridePrice,
      isPriceOverridden: true,
    };
  }

  let offer;
  let resolvedStoneComponents;
  let makingChargeDiscountAmount;
  let appliedMakingChargeRuleId = null;
  let appliedMakingChargeRuleName = null;
  let makingChargeDiscountSource = 'NONE';

  if (ruleSet) {
    const purityValueId = variant?.attributes?.purity?.valueId ?? null;
    // Skip the ancestor-chain lookup entirely unless a CATEGORY-scope rule
    // of either type actually exists.
    const needsCategoryLookup =
      product.category_id != null && (ruleSet.makingByCategory.size > 0 || ruleSet.stoneByCategory.size > 0);
    const categoryAncestorIds = needsCategoryLookup ? await getCategoryAndAncestorIds(product.category_id) : [];

    const makingChargeDiscount = resolveMakingChargeDiscount({
      product,
      categoryAncestorIds,
      purityValueId,
      purityRuleRow: purityPricingRule,
      ruleSet,
      makingCharge,
    });
    const componentsWithDiscount = stoneComponentsRaw.map((c) => ({
      ...c,
      discount: resolveStoneDiscount({ product, categoryAncestorIds, purityRuleRow: purityPricingRule, ruleSet, component: c }),
    }));

    const NEW_RULE_SOURCES = new Set(['PRODUCT_RULE', 'CATEGORY_RULE', 'GLOBAL_RULE']);
    const usesNewRule =
      NEW_RULE_SOURCES.has(makingChargeDiscount.source) ||
      componentsWithDiscount.some((c) => NEW_RULE_SOURCES.has(c.discount.source));

    if (usesNewRule) {
      const resolved = applyResolvedDiscounts({
        goldValue,
        makingCharge,
        gstPercent,
        sellingPrice: baseSellingPrice,
        makingChargeDiscount,
        stoneComponents: componentsWithDiscount,
      });
      offer = resolved;
      resolvedStoneComponents = resolved.stoneComponents;
      makingChargeDiscountAmount = makingChargeDiscount.amount;
      appliedMakingChargeRuleId = makingChargeDiscount.ruleId;
      appliedMakingChargeRuleName = makingChargeDiscount.ruleName;
      makingChargeDiscountSource = makingChargeDiscount.source;
    } else {
      // No PRODUCT/CATEGORY/GLOBAL rule actually applies to this product's
      // making charge OR any stone line — fall back to the exact flat/purity
      // offer formula (tiers 2/3 only, same values resolveTier already
      // agreed on) so the numeric output is byte-identical to the no-ruleSet
      // path, not just equivalent.
      offer = applyProductOffer({
        goldValue,
        stoneValue,
        makingCharge,
        gstPercent,
        sellingPrice: baseSellingPrice,
        makingChargeDiscountPercent,
        stoneDiscountPercent,
      });
      resolvedStoneComponents = componentsWithDiscount.map(({ discount, ...c }) => ({
        ...c,
        finalValue: round2(c.value - discount.amount),
        discountAmount: discount.amount,
        discountPercent: discount.percent,
        appliedRuleId: null,
        appliedRuleName: null,
        source: discount.source,
        clamped: false,
      }));
      makingChargeDiscountAmount = round2(makingCharge - offer.makingCharge);
      makingChargeDiscountSource = makingChargeDiscount.source;
    }
  } else {
    // No ruleSet passed at all — only the product's own flat/purity offer
    // percentages apply.
    offer = applyProductOffer({
      goldValue,
      stoneValue,
      makingCharge,
      gstPercent,
      sellingPrice: baseSellingPrice,
      makingChargeDiscountPercent,
      stoneDiscountPercent,
    });
    resolvedStoneComponents = undiscountedComponents(stoneComponentsRaw);
    makingChargeDiscountAmount = round2(makingCharge - offer.makingCharge);
  }

  const gstAmount = round2(offer.sellingPrice - offer.goldValue - offer.stoneValue - offer.makingCharge);

  return {
    ...shared,
    goldValue: offer.goldValue,
    stoneValue: offer.stoneValue,
    stoneValueOriginal: offer.stoneValueOriginal,
    makingCharge: offer.makingCharge,
    makingChargeOriginal: offer.makingChargeOriginal,
    makingChargeDiscountPercent: offer.makingChargeDiscountPercent,
    stoneDiscountPercent: offer.stoneDiscountPercent,
    makingChargeDiscountAmount,
    appliedMakingChargeRuleId,
    appliedMakingChargeRuleName,
    makingChargeDiscountSource,
    stoneComponents: resolvedStoneComponents,
    stoneDiscountAmount: round2(offer.stoneValueOriginal - offer.stoneValue),
    gstAmount,
    sellingPrice: offer.sellingPrice,
    sellingPriceOriginal: offer.sellingPriceOriginal,
    isPriceOverridden: false,
  };
}
