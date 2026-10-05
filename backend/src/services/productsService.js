import { withTransaction } from '../config/db.js';
import { slugify } from '../utils/slug.js';
import { NotFoundError, AppError } from '../utils/AppError.js';
import {
  listProducts as listProductsRow,
  findProductBySlug,
  findProductById,
  findProductImages,
  createProduct as createProductRow,
  updateProduct as updateProductRow,
  deleteProduct as deleteProductRow,
} from '../repositories/products.repository.js';
import {
  findVariantsByProductId,
  findAvailableVariantsByProductId,
  findVariantById,
  findProductAttributeCatalogue,
  updateVariantFields,
  bulkUpdateVariantFields,
} from '../repositories/productVariants.repository.js';
import { findMeasurementsByProductId } from '../repositories/productSizeMeasurements.repository.js';
import { findByProductId as findGeneratedSizeImageByProductId } from '../repositories/productSizeGeneratedImages.repository.js';
import {
  syncProductVariants,
  applyExclusionRules,
  applySizeStockUpdates,
  pruneOrphanedPurityRules,
} from './variantSyncService.js';
import {
  findExclusionRulesByProduct,
  createExclusionRule,
  deleteExclusionRule,
} from '../repositories/exclusionRules.repository.js';
import {
  findWeightRulesByProduct,
  findWeightRuleValuesByProduct,
  replaceWeightRules,
} from '../repositories/weightRules.repository.js';
import {
  findPurityPricingRulesByProduct,
  findPurityPricingRuleValuesByProduct,
  replacePurityPricingRules,
} from '../repositories/purityPricingRules.repository.js';
import {
  findCategoryBySlug,
  getCategoryAndDescendantIds,
} from '../repositories/categories.repository.js';
import { findCollectionBySlug } from '../repositories/collections.repository.js';
import { findDiamondConfigById } from '../repositories/diamondConfigs.repository.js';
import { findDiamondTypeById } from '../repositories/diamondTypes.repository.js';
import { computeVariantPricing, resolvePurityPricingFields } from './pricingService.js';
import { loadActiveRuleSet } from './pricingRuleResolver.js';
import { invalidateProductPages } from './pageCacheInvalidation.js';

// Weight-rule and variant edits must invalidate the SSR page cache after
// their transaction commits — never before, so a concurrent request can
// never observe a cache miss followed by a re-render of pre-commit data.
// Invalidation failing here must not roll back or fail an otherwise
// successful save (the write already committed); it's logged instead, same
// pattern as paymentService.js's invalidateOrderProductPages, so a stale
// cache row is at least visible in logs rather than silently persisting for
// the rest of its TTL.
async function safeInvalidateProductPages(product, operationName, previousCategoryId) {
  try {
    await invalidateProductPages(product, previousCategoryId);
  } catch (err) {
    console.error(`Page cache invalidation after ${operationName} failed (product ${product.id}):`, err);
  }
}

// Both net_weight_grams and gross_weight_grams are derived, not
// admin-entered directly. Net weight is the precious-metal-only weight
// (what pricingService.computeGoldValue actually prices against); gross
// weight is the total finished-piece weight (gold + diamond) shown to
// customers alongside it.
function deriveNetWeightGrams(goldWeightGrams) {
  return goldWeightGrams ?? null;
}

function deriveGrossWeightGrams(goldWeightGrams, diamondWeightGrams) {
  if (goldWeightGrams == null && diamondWeightGrams == null) return null;
  return Math.round(((goldWeightGrams ?? 0) + (diamondWeightGrams ?? 0)) * 1000) / 1000;
}

// products.diamond_type (free TEXT) is being retired in favor of
// diamond_type_id (Pricing Rule Management, Phase 4) — whenever the admin
// form sends a diamondTypeId, this keeps the legacy text column in sync
// with it automatically (never independently editable anymore), so the two
// can never drift apart the way the plan's "denormalized display copy"
// promise requires. Mutates `fields` in place, mirroring
// deriveNetWeightGrams/deriveGrossWeightGrams's own call style above.
async function syncDiamondTypeName(fields) {
  if (!Object.hasOwn(fields, 'diamondTypeId')) return;
  if (!fields.diamondTypeId) {
    fields.diamondType = null;
    return;
  }
  const diamondType = await findDiamondTypeById(fields.diamondTypeId);
  fields.diamondType = diamondType?.name ?? null;
}

// Mirrors web/src/hooks/useVariantSelection.ts's own default-size effect
// exactly (ascending parseInt of the label, NaN-safe tie as 0) — the
// product's cached base price must resolve the SAME size the PDP silently
// pre-selects on load, or a purity+size Weight Defaults rule that differs
// from the purity-only rule causes a permanent PLP-vs-PDP price mismatch no
// amount of re-running the recompute can ever fix (it would keep computing
// the *wrong* variant's price correctly). No shared module between the web
// bundle and this backend to import this from — keep both in sync by hand
// if either one's tie-breaking or parsing rule ever changes.
function pickSmallestSizeValue(sizeValues) {
  if (!sizeValues || sizeValues.length === 0) return null;
  return [...sizeValues].sort((a, b) => {
    const na = parseInt(a.label, 10);
    const nb = parseInt(b.label, 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) return 0;
    return na - nb;
  })[0];
}

// Builds a synthetic, non-persisted "variant" representing the exact same
// default configuration the PDP prices before a shopper touches anything
// (its own Purity, plus whichever size useVariantSelection.ts would
// auto-select — not any real product_variants row), purely so
// computeVariantPricing takes its live-recompute path (every branch there
// keys off `variant != null`) instead of trusting the (possibly stale, e.g.
// after a gold-rate sync) cached gold_value/diamond_value columns. Carries
// no weight/diamond overrides of its own, so weight resolution still falls
// through the normal rule-then-base-weight chain, and no price_override, so
// a manual override never leaks in here.
async function buildBaseConfigVariant(product) {
  const attributes = {};
  if (product.purity) {
    const catalogue = await findProductAttributeCatalogue(product.id);
    const purityValue = catalogue.find((a) => a.code === 'purity')?.values.find((v) => v.value === product.purity);
    if (purityValue) {
      attributes.purity = { valueId: purityValue.id, value: purityValue.value, label: purityValue.label, refId: null };
    }
    const sizeValues = catalogue.find((a) => a.code === 'size')?.values;
    const defaultSize = pickSmallestSizeValue(sizeValues);
    if (defaultSize) {
      attributes.size = { valueId: defaultSize.id, value: defaultSize.value, label: defaultSize.label, refId: null };
    }
  }
  return {
    gold_weight_grams: null,
    diamond_weight_carats: null,
    price_override: null,
    combination_key: 'base-config',
    attributes,
  };
}

// A product's listing/base price — and the PDP's price before the shopper
// touches anything — reflects the product's own base configuration (the
// Metal/Diamond/Pricing section on the admin form: its own Purity, Gold
// Weight, Diamond Weight, Making Charge %), not whichever variant happens to
// be cheapest. Deliberately does NOT scan product_variants at all — every
// real variant is still priced live at read time by computeVariantPricing
// itself (PDP price-preview, cart, checkout, admin variant list), this only
// refreshes the cached base numbers used by listing/card views and a PDP's
// price before anything is selected.
// Null-safe percent comparison — null and 0 are different states (no cached
// value yet vs. a resolved 0%), so this must not treat them as equal.
function percentDiffers(a, b) {
  if (a == null || b == null) return a !== b;
  return Math.abs(a - b) > 1e-9;
}

// Same null-safe comparison as percentDiffers, for the new amount/id cache
// columns (Pricing Rule Management) — null and 0/absent are different
// states, and a UUID id either matches or it doesn't.
function amountDiffers(a, b) {
  if (a == null || b == null) return a !== b;
  return Math.abs(a - b) > 1e-9;
}

function idDiffers(a, b) {
  return (a ?? null) !== (b ?? null);
}

// Deterministic, key-order-independent stringify — Postgres's jsonb type
// explicitly does NOT preserve object key order (unlike the json type), so
// a plain JSON.stringify(freshValue) === JSON.stringify(storedValue) check
// would spuriously report "changed" after every round trip through the
// database even when the content is identical. Used only for the unchanged
// comparison below, never for what's actually written.
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

// productId, isPriceLocked -> { changed, oldSellingPrice, newSellingPrice }.
// The return value used to be undefined; every one of this function's ~8
// call sites in this file ignored it, so returning a value is non-breaking.
// It exists so the Phase 2 background repricing job (and, as a smaller
// side-benefit, the existing gold/diamond recalculation jobs) can tell
// whether a price actually changed without a second findProductById just to
// diff before/after.
//
// `ruleSet` is optional — omitted, this loads the current live rule set
// itself (cheap: pricingRuleResolver caches it for 30s), so every existing
// caller (admin product save, gold/diamond recalculation jobs) automatically
// resolves through Pricing Rule Management once rules exist, with zero call
// site changes needed. A caller repricing many products in one pass (the
// Phase 2 job) should load the rule set once and pass it explicitly instead,
// to avoid loading it once per product.
export async function applyBaseProductPricing(productId, isPriceLocked, ruleSet = null) {
  if (isPriceLocked) return { changed: false, oldSellingPrice: null, newSellingPrice: null };
  const product = await findProductById(productId);
  if (!product) return { changed: false, oldSellingPrice: null, newSellingPrice: null };

  const oldSellingPrice = Number(product.selling_price);
  const weightRules = await findWeightRuleValuesByProduct(productId);
  const purityPricingRules = await findPurityPricingRuleValuesByProduct(productId);
  const baseVariant = await buildBaseConfigVariant(product);
  const effectiveRuleSet = ruleSet ?? (await loadActiveRuleSet());
  const pricing = await computeVariantPricing(product, baseVariant, weightRules, purityPricingRules, effectiveRuleSet);

  // effective_making_charge_discount_percent / effective_diamond_discount_percent
  // are what list-view cards (rowOffer/toListDto) actually read for the offer
  // badge/discounted price — resolved through the same Purity Pricing Rule as
  // the PDP, so a purity-specific discount shows up in listings too, not just
  // on the detail page. Deliberately separate columns from
  // making_charge_discount_percent/diamond_discount_percent (the admin's own
  // typed default) so editing a purity rule never silently overwrites that
  // default field.
  const currentEffectiveMakingDiscount =
    product.effective_making_charge_discount_percent == null ? null : Number(product.effective_making_charge_discount_percent);
  const currentEffectiveDiamondDiscount =
    product.effective_diamond_discount_percent == null ? null : Number(product.effective_diamond_discount_percent);
  const currentEffectiveMakingAmount =
    product.effective_making_charge_discount_amount == null ? null : Number(product.effective_making_charge_discount_amount);
  const currentEffectiveDiamondAmount =
    product.effective_diamond_discount_amount == null ? null : Number(product.effective_diamond_discount_amount);
  const currentEffectiveMakingRuleId = product.effective_making_charge_rule_id ?? null;
  const currentEffectiveDiamondRuleId = product.effective_diamond_rule_id ?? null;
  const currentBreakdownStable = stableStringify(product.effective_diamond_breakdown ?? []);

  const newMakingRuleId = pricing.appliedMakingChargeRuleId ?? null;
  const newDiamondRuleId = pricing.diamondComponents[0]?.appliedRuleId ?? null;
  const newBreakdownJson = JSON.stringify(pricing.diamondComponents);
  const newBreakdownStable = stableStringify(pricing.diamondComponents);

  // Every field compared here is a field the write below actually sets —
  // comparing only the aggregate sellingPriceOriginal let a prior bug through:
  // a caller (e.g. the admin form) can write goldValue/makingCharge/
  // sellingPrice directly in one PATCH, in a combination where the total
  // happens to already match this recompute even though a component (like
  // makingCharge) doesn't — that combination must still be corrected, not
  // skipped, or the stored breakdown stays internally inconsistent forever
  // (list/detail priceBreakup shows the wrong makingCharge while the total
  // "coincidentally" looks right).
  const unchanged =
    Math.abs(pricing.goldValue - Number(product.gold_value)) < 1e-9 &&
    Math.abs(pricing.diamondValueOriginal - Number(product.diamond_value)) < 1e-9 &&
    Math.abs(pricing.makingChargeOriginal - Number(product.making_charge)) < 1e-9 &&
    Math.abs(pricing.sellingPriceOriginal - Number(product.selling_price)) < 1e-9 &&
    !percentDiffers(pricing.makingChargeDiscountPercent, currentEffectiveMakingDiscount) &&
    !percentDiffers(pricing.diamondDiscountPercent, currentEffectiveDiamondDiscount) &&
    !amountDiffers(pricing.makingChargeDiscountAmount, currentEffectiveMakingAmount) &&
    !amountDiffers(pricing.diamondDiscountAmount, currentEffectiveDiamondAmount) &&
    !idDiffers(newMakingRuleId, currentEffectiveMakingRuleId) &&
    !idDiffers(newDiamondRuleId, currentEffectiveDiamondRuleId) &&
    newBreakdownStable === currentBreakdownStable;
  if (unchanged) return { changed: false, oldSellingPrice, newSellingPrice: oldSellingPrice };

  await updateProductRow(productId, {
    goldValue: pricing.goldValue,
    diamondValue: pricing.diamondValueOriginal,
    makingCharge: pricing.makingChargeOriginal,
    sellingPrice: pricing.sellingPriceOriginal,
    effectiveMakingChargeDiscountPercent: pricing.makingChargeDiscountPercent,
    effectiveDiamondDiscountPercent: pricing.diamondDiscountPercent,
    effectiveMakingChargeDiscountAmount: pricing.makingChargeDiscountAmount,
    effectiveDiamondDiscountAmount: pricing.diamondDiscountAmount,
    effectiveMakingChargeRuleId: newMakingRuleId,
    effectiveDiamondRuleId: newDiamondRuleId,
    effectiveDiamondBreakdown: newBreakdownJson,
  });

  return { changed: true, oldSellingPrice, newSellingPrice: pricing.sellingPriceOriginal };
}

// Resolves purity/size *codes* ("9K", "6") to this product's actual
// attribute_value UUIDs — shared by the standalone Weight Defaults / Purity
// Pricing Rules endpoints (adminReplaceWeightRules/
// adminReplacePurityPricingRules below) and the combined product
// create/update save (applyWeightAndPricingRulesInTx), so both reject an
// unconfigured purity/size identically. Must be called after
// syncProductVariants has run for this request — that's what creates a
// brand-new size's product-scoped attribute_value row; a purity's global row
// always exists already (seeded once, product-independent).
async function buildPurityAndSizeResolver(productId) {
  const catalogue = await findProductAttributeCatalogue(productId);
  const purityByValue = new Map(
    (catalogue.find((a) => a.code === 'purity')?.values ?? []).map((v) => [v.value, v.id]),
  );
  const sizeByLabel = new Map((catalogue.find((a) => a.code === 'size')?.values ?? []).map((v) => [v.value, v.id]));
  function resolve(purity, sizeLabel) {
    const purityValueId = purityByValue.get(purity);
    if (!purityValueId) throw new AppError(409, `Purity ${purity} is not offered by this product`);
    if (sizeLabel == null) return { purityValueId, sizeValueId: null };
    const sizeValueId = sizeByLabel.get(sizeLabel);
    if (!sizeValueId) throw new AppError(409, `Size ${sizeLabel} is not offered by this product`);
    return { purityValueId, sizeValueId };
  }
  return { purityByValue, sizeByLabel, resolve };
}

// Resolves and persists weightRules/purityPricingRules as part of the
// combined product create/update save — called from inside the SAME
// withTransaction as the product row insert/update and syncProductVariants,
// so a failure here rolls back the entire save, not just these two tables.
// replaceWeightRules/replacePurityPricingRules are the plain repository
// functions (not adminReplaceWeightRules/adminReplacePurityPricingRules
// below, which each open their OWN withTransaction — calling one of those
// from inside this transaction would connect a second pool client and
// commit independently, breaking atomicity). Both repository functions use
// the ambient query() from config/db.js, so they transparently join
// whichever transaction is active via AsyncLocalStorage.
//
// PATCH semantics: `weightRules`/`purityPricingRules` being `undefined`
// (the key was absent from the request) leaves the saved rows completely
// untouched — this function returns immediately for that half of the call.
// An explicitly-sent empty collection (`{purityRules: [], puritySizeRules:
// []}` or `[]`) intentionally clears it — replaceWeightRules/
// replacePurityPricingRules already treat "no rows" as "delete everything,
// insert nothing" (see their own DELETE-then-INSERT bodies).
async function applyWeightAndPricingRulesInTx(productId, { weightRules, purityPricingRules }) {
  if (weightRules === undefined && purityPricingRules === undefined) return;
  const { resolve } = await buildPurityAndSizeResolver(productId);

  if (weightRules !== undefined) {
    const resolved = new Map();
    for (const r of weightRules.purityRules) {
      const { purityValueId, sizeValueId } = resolve(r.purity, null);
      resolved.set(`${purityValueId}|`, { purityValueId, sizeValueId, goldWeightGrams: r.goldWeightGrams });
    }
    for (const r of weightRules.puritySizeRules) {
      const { purityValueId, sizeValueId } = resolve(r.purity, r.sizeLabel);
      resolved.set(`${purityValueId}|${sizeValueId}`, { purityValueId, sizeValueId, goldWeightGrams: r.goldWeightGrams });
    }
    await replaceWeightRules(productId, [...resolved.values()]);
  }

  if (purityPricingRules !== undefined) {
    const resolved = purityPricingRules.map((r) => {
      const { purityValueId } = resolve(r.purity, null);
      return {
        purityValueId,
        makingChargePercent: r.makingChargePercent ?? null,
        makingChargeDiscountPercent: r.makingChargeDiscountPercent ?? null,
        diamondDiscountPercent: r.diamondDiscountPercent ?? null,
      };
    });
    await replacePurityPricingRules(productId, resolved);
  }
}

export async function resolveCategoryIds(categorySlug) {
  if (!categorySlug) return undefined;
  const category = await findCategoryBySlug(categorySlug);
  if (!category) return []; // unknown slug -> no matches, not an error
  return getCategoryAndDescendantIds(category.id);
}

async function resolveCollectionId(collectionSlug) {
  if (!collectionSlug) return undefined;
  const collection = await findCollectionBySlug(collectionSlug);
  return collection?.id ?? null; // null on unknown slug -> no matches
}

export async function listPublicProducts({
  categorySlug,
  collectionSlug,
  metalType,
  purity,
  goldColor,
  priceMin,
  priceMax,
  sort,
  page,
  limit,
  placement: placementContext,
}) {
  const categoryIds = await resolveCategoryIds(categorySlug);
  const collectionId = await resolveCollectionId(collectionSlug);
  if (collectionId === null || (categoryIds && categoryIds.length === 0)) {
    return { items: [], total: 0 };
  }

  // Which admin "First 50" order applies: the homepage collection showcase
  // asks for it explicitly (placement=homepage) so the /collections page
  // keeps its own default order; a category page uses the order saved for
  // that exact category (a subcategory page has its own, independent order
  // — never its parent's).
  let placement = null;
  if (placementContext === 'homepage' && collectionId) {
    placement = { type: 'homepage_collection', id: collectionId };
  } else if (categorySlug && categoryIds?.length && !collectionId) {
    const category = await findCategoryBySlug(categorySlug);
    if (category) placement = { type: 'category', id: category.id };
  }

  return listProductsRow(
    {
      categoryIds,
      collectionId,
      metalType,
      purity,
      goldColor,
      priceMin,
      priceMax,
      status: 'PUBLISHED',
      excludeZeroPrice: true,
    },
    { sort, page, limit, placement },
  );
}

// A Product Size Image is only ever storefront-eligible when it's the
// currently active row, generation actually succeeded (passed/warning —
// same "warning still counts as usable" convention AI Studio's other asset
// types use), and its measurement_version still matches the live
// measurements row — the moment an admin edits measurements this stops
// matching until a fresh regeneration succeeds (plan point 1/10). Ineligible
// PRODUCT_SIZE rows are filtered out here, at the source, rather than left
// for the frontend to reason about staleness itself. The measurements
// themselves (for the "Product dimensions" PDP text) are attached
// regardless of image eligibility — text has no staleness risk, since it's
// always read live.
async function attachProductSizeImage(product, images) {
  const measurements = await findMeasurementsByProductId(product.id);
  if (!measurements) {
    return { images, productSizeMeasurements: null };
  }

  const generated = await findGeneratedSizeImageByProductId(product.id);
  const eligible =
    !!generated &&
    generated.is_active &&
    (generated.status === 'passed' || generated.status === 'warning') &&
    generated.measurement_version === measurements.version;

  const filteredImages = images.filter(
    (img) => img.type !== 'PRODUCT_SIZE' || (eligible && img.sort_order === generated.image_sort_order),
  );

  return {
    images: filteredImages,
    productSizeMeasurements: {
      jewelleryType: measurements.jewellery_type,
      unit: measurements.unit,
      measurements: measurements.measurements,
      includedParts: measurements.included_parts,
      excludedParts: measurements.excluded_parts,
      note: measurements.note,
    },
  };
}

export async function getPublicProductBySlug(slug) {
  const product = await findProductBySlug(slug);
  if (!product || product.status !== 'PUBLISHED') {
    throw new NotFoundError('Product not found');
  }
  const rawImages = await findProductImages(product.id);
  const { images, productSizeMeasurements } = await attachProductSizeImage(product, rawImages);
  const attributes = await findProductAttributeCatalogue(product.id);
  const variants = await findAvailableVariantsByProductId(product.id);
  const diamondConfigName = product.diamond_config_id
    ? ((await findDiamondConfigById(product.diamond_config_id))?.name ?? null)
    : null;
  return { ...product, images, attributes, variants, diamondConfigName, productSizeMeasurements };
}

export async function getRelatedProducts(slug, limit = 4) {
  const product = await findProductBySlug(slug);
  if (!product || product.status !== 'PUBLISHED') return [];
  const categoryIds = await getCategoryAndDescendantIds(product.category_id);
  const { items } = await listProductsRow(
    { categoryIds, status: 'PUBLISHED', excludeId: product.id, excludeZeroPrice: true },
    { sort: 'newest', page: 1, limit },
  );
  return items;
}

// PDP "Most Loved" section — same category-scoping/exclusion as related
// products, just ranked by the existing best-seller sort (sold_count, same
// one the PLP's "Best Sellers" sort option and homepage use) instead of
// recency.
export async function getMostLovedProducts(slug, limit = 8) {
  const product = await findProductBySlug(slug);
  if (!product || product.status !== 'PUBLISHED') return [];
  const categoryIds = await getCategoryAndDescendantIds(product.category_id);
  const { items } = await listProductsRow(
    { categoryIds, status: 'PUBLISHED', excludeId: product.id, excludeZeroPrice: true },
    { sort: 'bestseller', page: 1, limit },
  );
  return items;
}

export function adminListProducts(filters, pagination) {
  return listProductsRow(filters, pagination);
}

export async function adminGetProduct(id) {
  const product = await findProductById(id);
  if (!product) throw new NotFoundError('Product not found');
  const images = await findProductImages(id);
  const attributes = await findProductAttributeCatalogue(id);
  const variants = await findVariantsByProductId(id);
  return { ...product, images, attributes, variants };
}

export async function adminCreateProduct(input) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  const {
    sizes: sizesInput,
    goldColors,
    purities,
    diamondConfigIds,
    variantOverrides,
    weightRules,
    purityPricingRules,
    ...fields
  } = input;
  fields.netWeightGrams = deriveNetWeightGrams(fields.goldWeightGrams);
  fields.grossWeightGrams = deriveGrossWeightGrams(fields.goldWeightGrams, fields.diamondWeightGrams);
  await syncDiamondTypeName(fields);

  // The row insert, variant-matrix generation, weight/purity-pricing rule
  // application, and cheapest-price cache refresh all succeed or fail
  // together — a mid-sequence failure (e.g. a DB hiccup after variants are
  // created but before pricing is cached) used to leave a half-configured
  // product behind instead of rolling back to nothing. Product create/edit
  // is a single continuous form (Product Create/Edit Architecture Report,
  // 2026-09-07) — Weight Defaults and Purity Pricing Rules are entered and
  // saved in this same transaction, not as separate save actions requiring
  // the admin to reopen the product afterward.
  const product = await withTransaction(async () => {
    const created = await createProductRow({ ...fields, slug, status: input.status ?? 'DRAFT' });
    await syncProductVariants(created.id, {
      goldColors,
      purities,
      diamondConfigIds,
      sizes: sizesInput,
      stockQuantity: fields.stockQuantity ?? created.stock_quantity,
      variantOverrides,
    });
    // Resolved against the purities/sizes syncProductVariants just created —
    // must run after it, never before.
    await applyWeightAndPricingRulesInTx(created.id, { weightRules, purityPricingRules });
    await applyBaseProductPricing(created.id, fields.isPriceLocked ?? created.is_price_locked);
    // available_stock rolls up from variants, and price may have just been
    // reconciled — re-fetch so the response reflects both.
    return findProductById(created.id);
  });

  // Cache invalidation deliberately runs after the transaction commits —
  // invalidating pages for a write that then rolled back would be wrong.
  await invalidateProductPages(product);
  const attributes = await findProductAttributeCatalogue(product.id);
  const variants = await findVariantsByProductId(product.id);
  return { ...product, attributes, variants };
}

export async function adminUpdateProduct(id, input) {
  const existing = await findProductById(id);
  if (!existing) throw new NotFoundError('Product not found');

  const {
    sizes: sizesInput,
    goldColors,
    purities,
    diamondConfigIds,
    variantOverrides,
    weightRules,
    purityPricingRules,
    ...fields
  } = input;
  if (Object.hasOwn(fields, 'slug') && fields.slug) {
    fields.slug = slugify(fields.slug);
  }
  if (Object.hasOwn(fields, 'goldWeightGrams') || Object.hasOwn(fields, 'diamondWeightGrams')) {
    const goldWeightGrams = Object.hasOwn(fields, 'goldWeightGrams')
      ? fields.goldWeightGrams
      : existing.gold_weight_grams == null
        ? null
        : Number(existing.gold_weight_grams);
    const diamondWeightGrams = Object.hasOwn(fields, 'diamondWeightGrams')
      ? fields.diamondWeightGrams
      : existing.diamond_weight_grams == null
        ? null
        : Number(existing.diamond_weight_grams);
    fields.netWeightGrams = deriveNetWeightGrams(goldWeightGrams);
    fields.grossWeightGrams = deriveGrossWeightGrams(goldWeightGrams, diamondWeightGrams);
  }
  await syncDiamondTypeName(fields);
  const axesChanged =
    sizesInput !== undefined ||
    goldColors !== undefined ||
    purities !== undefined ||
    diamondConfigIds !== undefined ||
    variantOverrides !== undefined;

  // Same all-or-nothing guarantee as adminCreateProduct — the row update,
  // variant-matrix regeneration, rule re-application, and price-cache
  // refresh either all land or none do.
  const product = await withTransaction(async () => {
    await updateProductRow(id, fields);
    if (axesChanged) {
      // A PATCH-style update that only touches one axis (e.g. just Purity)
      // shouldn't wipe out the others — fall back to what's currently
      // configured for any axis this request didn't include.
      const currentCatalogue = await findProductAttributeCatalogue(id);
      const currentValues = (code, pick) => currentCatalogue.find((a) => a.code === code)?.values.map(pick) ?? [];
      // Existing size *labels* are preserved even when this update doesn't
      // touch sizes at all (needed so the cross-product below still includes
      // the size axis) — new stock/weight seeds only matter for a genuinely
      // new combination (e.g. a newly added color crossed with an existing
      // size), which intentionally starts at 0 stock pending admin review via
      // the variant editor, same as any other brand-new combination.
      const preservedSizes = currentValues('size', (v) => ({
        label: v.value,
        stockQuantity: 0,
        weightGrams: null,
        diamondWeightCarats: null,
      }));
      await syncProductVariants(id, {
        goldColors: goldColors ?? currentValues('gold_color', (v) => v.value),
        purities: purities ?? currentValues('purity', (v) => v.value),
        diamondConfigIds: diamondConfigIds ?? currentValues('diamond_quality', (v) => v.refId),
        sizes: sizesInput ?? preservedSizes,
        stockQuantity: fields.stockQuantity ?? existing.stock_quantity,
        variantOverrides,
      });
      // Only when the request actually included sizes (not the
      // label-only preservedSizes fallback, which carries a meaningless
      // placeholder stockQuantity of 0 for every row) — applies any size
      // whose Stock the admin actually changed to every existing variant
      // of that size.
      if (sizesInput !== undefined) {
        await applySizeStockUpdates(id, sizesInput);
      }
      // A removed purity/size can leave orphaned product_weight_rules/
      // product_purity_pricing_rules rows behind — both FK the attribute_value
      // directly, not the product_attribute_values join syncProductVariants
      // just resynced, so they don't cascade on their own. Runs regardless of
      // whether this same request also sends weightRules/purityPricingRules
      // (harmless no-op then — an explicit replace below can only reference
      // currently-offered values anyway) so a request that changes axes
      // WITHOUT touching the rule sections still cleans up correctly.
      await pruneOrphanedPurityRules(id);
    }
    // Resolved against this product's current purities/sizes — whatever
    // syncProductVariants above just left in place, or (if axesChanged was
    // false) whatever was already saved.
    await applyWeightAndPricingRulesInTx(id, { weightRules, purityPricingRules });
    await applyBaseProductPricing(id, fields.isPriceLocked ?? existing.is_price_locked);
    return findProductById(id);
  });

  await invalidateProductPages(product, existing.category_id);
  const attributes = await findProductAttributeCatalogue(id);
  const variants = await findVariantsByProductId(id);
  return { ...product, attributes, variants };
}

// Public/customer-facing price preview for a specific variant — reuses the
// same numeric engine as cart/checkout so the number shown while shopping
// always matches what gets charged.
export async function previewProductVariantPricing(id, { variantId }) {
  const product = await findProductById(id);
  if (!product || product.status !== 'PUBLISHED') throw new NotFoundError('Product not found');

  let variant = null;
  if (variantId) {
    variant = await findVariantById(variantId);
    if (!variant || variant.product_id !== id) {
      throw new NotFoundError('Selected variant is not available for this product');
    }
    if (!variant.is_available) {
      throw new AppError(409, 'Selected combination is no longer available');
    }
  }

  // This is the storefront PDP's live variant-price-preview endpoint
  // (public route, hit every time a shopper changes purity/size/diamond
  // quality) — it must resolve through the same ruleSet the cached PLP/
  // homepage price already does (applyBaseProductPricing), or a shopper
  // sees one price on the listing card and a DIFFERENT one the moment they
  // pick a variant on the PDP.
  const ruleSet = await loadActiveRuleSet();
  const pricing = await computeVariantPricing(product, variant, null, null, ruleSet);
  const mrp = Number(product.mrp);
  const discountPercent =
    mrp && mrp > pricing.sellingPrice ? Math.round(((mrp - pricing.sellingPrice) / mrp) * 100) : 0;
  return { ...pricing, mrp, discountPercent };
}

// Admin variant editor — one row per real combination, each with its own
// live price (same engine as everywhere else) so the admin sees exactly
// what a shopper would be charged for that exact combination.
export async function adminListVariants(productId) {
  const product = await findProductById(productId);
  if (!product) throw new NotFoundError('Product not found');
  const variants = await findVariantsByProductId(productId);
  const weightRules = await findWeightRuleValuesByProduct(productId);
  const purityPricingRules = await findPurityPricingRuleValuesByProduct(productId);
  const ruleSet = await loadActiveRuleSet();
  return Promise.all(
    variants.map(async (variant) => {
      const pricing = await computeVariantPricing(
        product,
        variant.combination_key === '' ? null : variant,
        weightRules,
        purityPricingRules,
        ruleSet,
      );
      return { variant, pricing };
    }),
  );
}

export async function adminUpdateVariant(productId, variantId, fields) {
  const product = await findProductById(productId);
  if (!product) throw new NotFoundError('Product not found');
  const existing = await findVariantById(variantId);
  if (!existing || existing.product_id !== productId) throw new NotFoundError('Variant not found');

  const updated = await withTransaction(async () => {
    const u = await updateVariantFields(productId, variantId, fields);
    // The product's own cached "cheapest available" price can shift once a
    // specific variant's stock/weight/availability changes (e.g. the admin
    // just made the previously-cheapest combination unavailable).
    await applyBaseProductPricing(productId, product.is_price_locked);
    return u;
  });
  await safeInvalidateProductPages(product, 'adminUpdateVariant');
  const ruleSet = await loadActiveRuleSet();
  const pricing = await computeVariantPricing(product, updated.combination_key === '' ? null : updated, null, null, ruleSet);
  return { variant: updated, pricing };
}

// Bulk-edit toolbar on the Advanced Variant Management table — same fields
// as adminUpdateVariant, applied to many rows in one call instead of N
// separate requests. "Reset to inherited" is this same endpoint called with
// weight/priceOverride fields explicitly set to null.
export async function adminBulkUpdateVariants(productId, variantIds, fields) {
  const product = await findProductById(productId);
  if (!product) throw new NotFoundError('Product not found');

  const updated = await withTransaction(async () => {
    const rows = await bulkUpdateVariantFields(productId, variantIds, fields);
    await applyBaseProductPricing(productId, product.is_price_locked);
    return rows;
  });
  await safeInvalidateProductPages(product, 'adminBulkUpdateVariants');

  const weightRules = await findWeightRuleValuesByProduct(productId);
  const purityPricingRules = await findPurityPricingRuleValuesByProduct(productId);
  const ruleSet = await loadActiveRuleSet();
  return Promise.all(
    updated.map(async (variant) => ({
      variant,
      pricing: await computeVariantPricing(
        product,
        variant.combination_key === '' ? null : variant,
        weightRules,
        purityPricingRules,
        ruleSet,
      ),
    })),
  );
}

// Weight Defaults — Purity and Purity+Size live weight resolution levels
// (see product_weight_rules migration for the full priority chain). The
// admin's "Weight Defaults" screen edits the whole set at once and saves
// with one action, so this is a full replace, not incremental CRUD.
export async function adminGetWeightRules(productId) {
  const product = await findProductById(productId);
  if (!product) throw new NotFoundError('Product not found');
  return findWeightRulesByProduct(productId);
}

export async function adminReplaceWeightRules(productId, { purityRules = [], puritySizeRules = [] }) {
  const product = await findProductById(productId);
  if (!product) throw new NotFoundError('Product not found');

  const { resolve } = await buildPurityAndSizeResolver(productId);

  // De-duplicated by (purity, size) so a caller sending the same pair twice
  // doesn't trip the DB's unique index — last one wins, matching how a form
  // re-submitting its own state would behave.
  const resolved = new Map();
  for (const r of purityRules) {
    const { purityValueId, sizeValueId } = resolve(r.purity, null);
    resolved.set(`${purityValueId}|`, { purityValueId, sizeValueId, goldWeightGrams: r.goldWeightGrams });
  }
  for (const r of puritySizeRules) {
    const { purityValueId, sizeValueId } = resolve(r.purity, r.sizeLabel);
    resolved.set(`${purityValueId}|${sizeValueId}`, { purityValueId, sizeValueId, goldWeightGrams: r.goldWeightGrams });
  }

  await withTransaction(async () => {
    await replaceWeightRules(productId, [...resolved.values()]);
    await applyBaseProductPricing(productId, product.is_price_locked);
  });
  await safeInvalidateProductPages(product, 'adminReplaceWeightRules');

  return findWeightRulesByProduct(productId);
}

// Purity Pricing Rules — Product+Purity overrides for making charge %,
// making charge discount %, and diamond discount %, all otherwise flat
// product-level fields (see product_purity_pricing_rules migration). Same
// "whole-set replace" shape as Weight Defaults, but resolved per-field with
// `??` rather than requiring every field to be set — a rule can override
// just one of the three and inherit the other two from the product.
export async function adminGetPurityPricingRules(productId) {
  const product = await findProductById(productId);
  if (!product) throw new NotFoundError('Product not found');

  const catalogue = await findProductAttributeCatalogue(productId);
  const purityValues = catalogue.find((a) => a.code === 'purity')?.values ?? [];
  const rules = await findPurityPricingRulesByProduct(productId);
  const ruleByPurityId = new Map(rules.map((r) => [r.purity_value_id, r]));

  return purityValues.map((p) => {
    const rule = ruleByPurityId.get(p.id) ?? null;
    const effective = resolvePurityPricingFields(product, rule);
    return {
      purityValueId: p.id,
      purity: p.value,
      purityLabel: p.label,
      makingChargePercent: rule ? (rule.making_charge_percent == null ? null : Number(rule.making_charge_percent)) : null,
      makingChargeDiscountPercent: rule
        ? rule.making_charge_discount_percent == null
          ? null
          : Number(rule.making_charge_discount_percent)
        : null,
      diamondDiscountPercent: rule
        ? rule.diamond_discount_percent == null
          ? null
          : Number(rule.diamond_discount_percent)
        : null,
      effectiveMakingChargePercent: effective.makingChargePercent,
      effectiveMakingChargeDiscountPercent: effective.makingChargeDiscountPercent,
      effectiveDiamondDiscountPercent: effective.diamondDiscountPercent,
    };
  });
}

export async function adminReplacePurityPricingRules(productId, { purityPricingRules = [] }) {
  const product = await findProductById(productId);
  if (!product) throw new NotFoundError('Product not found');

  const catalogue = await findProductAttributeCatalogue(productId);
  const purityValueIds = new Set((catalogue.find((a) => a.code === 'purity')?.values ?? []).map((v) => v.id));
  for (const r of purityPricingRules) {
    if (!purityValueIds.has(r.purityValueId)) {
      throw new AppError(409, 'One or more purities are not offered by this product');
    }
  }

  const rows = purityPricingRules.map((r) => ({
    purityValueId: r.purityValueId,
    makingChargePercent: r.makingChargePercent ?? null,
    makingChargeDiscountPercent: r.makingChargeDiscountPercent ?? null,
    diamondDiscountPercent: r.diamondDiscountPercent ?? null,
  }));

  await withTransaction(async () => {
    await replacePurityPricingRules(productId, rows);
    await applyBaseProductPricing(productId, product.is_price_locked);
  });
  await safeInvalidateProductPages(product, 'adminReplacePurityPricingRules');

  return adminGetPurityPricingRules(productId);
}

// Availability Rules — per-product pairwise exclusions ("this product's Rose
// Gold isn't offered in 9K"), replacing the old universal hardcoded rule.
// Values must both actually be offered by this product (in its
// product_attribute_values) and come from two different attributes — a rule
// within one attribute (e.g. two purities) has no meaning here.
export async function adminListExclusionRules(productId) {
  const product = await findProductById(productId);
  if (!product) throw new NotFoundError('Product not found');
  return findExclusionRulesByProduct(productId);
}

export async function adminCreateExclusionRule(productId, { attributeValueIdA, attributeValueIdB }) {
  const product = await findProductById(productId);
  if (!product) throw new NotFoundError('Product not found');

  const catalogue = await findProductAttributeCatalogue(productId);
  const codeByValueId = new Map();
  for (const attr of catalogue) {
    for (const v of attr.values) codeByValueId.set(v.id, attr.code);
  }
  const codeA = codeByValueId.get(attributeValueIdA);
  const codeB = codeByValueId.get(attributeValueIdB);
  if (!codeA || !codeB) throw new AppError(409, 'Both values must be offered by this product');
  if (codeA === codeB) throw new AppError(409, 'A rule must be between two different attributes');

  return withTransaction(async () => {
    const rule = await createExclusionRule(productId, attributeValueIdA, attributeValueIdB);
    await applyExclusionRules(productId);
    await applyBaseProductPricing(productId, product.is_price_locked);
    return rule;
  });
}

export async function adminDeleteExclusionRule(productId, ruleId) {
  const product = await findProductById(productId);
  if (!product) throw new NotFoundError('Product not found');
  await withTransaction(async () => {
    await deleteExclusionRule(productId, ruleId);
    await applyExclusionRules(productId);
    await applyBaseProductPricing(productId, product.is_price_locked);
  });
}

export async function adminDeleteProduct(id) {
  const existing = await findProductById(id);
  if (!existing) throw new NotFoundError('Product not found');
  await deleteProductRow(id);
  await invalidateProductPages(existing);
}
