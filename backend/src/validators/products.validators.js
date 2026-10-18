import { z } from 'zod';

// 9Karet sells 9K gold only — metal type and purity are fixed server-side
// (productsService.js), never chosen on the form.
const METAL_TYPES = ['GOLD'];
const PURITIES = ['9K'];
const GOLD_COLORS = ['YELLOW', 'ROSE', 'WHITE'];
const STATUSES = ['DRAFT', 'AI_PROCESSING', 'AI_READY', 'PUBLISHED', 'FAILED'];

// Each of the three purity-pricing fields is independently nullable — null
// means "inherit the product-level default for this one field", 0 means an
// explicit zero. Plain z.number() (not z.coerce.number()) so null survives
// untouched — coerce would turn null into NaN. Mirrors
// purityPricingRules.validators.js's identical `percent` schema; duplicated
// here rather than imported so this validator file has no cross-feature
// import (same convention already used for the PURITIES array above, which
// is independently redeclared in weightRules.validators.js and
// purityPricingRules.validators.js too).
const percent = z.number().min(0).max(100).nullable().optional().default(null);

// Combined-save shape for the product create/edit form's Weight Defaults
// section — same field shapes as replaceWeightRulesSchema
// (weightRules.validators.js), keyed by purity *code* (e.g. "9K") rather
// than a database purityValueId: on create, no attribute_value row exists
// yet for this product's purities, so the backend (productsService.js)
// resolves purity/size codes to UUIDs itself, after syncProductVariants has
// created them. Duplicate (purity) / (purity, sizeLabel) pairs are rejected
// here — the DB's own partial unique indexes would also reject them, but a
// 400 with a clear message beats a raw 23505 constraint-violation surfacing
// mid-transaction.
const weightRulesInputSchema = z
  .object({
    purityRules: z
      .array(z.object({ purity: z.enum(PURITIES), goldWeightGrams: z.coerce.number().positive() }))
      .default([]),
    puritySizeRules: z
      .array(
        z.object({
          purity: z.enum(PURITIES),
          sizeLabel: z.string().trim().min(1),
          goldWeightGrams: z.coerce.number().positive(),
        }),
      )
      .default([]),
  })
  .refine(
    (wr) => {
      const purityKeys = wr.purityRules.map((r) => r.purity);
      return new Set(purityKeys).size === purityKeys.length;
    },
    { message: 'Duplicate purity in weightRules.purityRules', path: ['weightRules', 'purityRules'] },
  )
  .refine(
    (wr) => {
      const sizeKeys = wr.puritySizeRules.map((r) => `${r.purity}|${r.sizeLabel}`);
      return new Set(sizeKeys).size === sizeKeys.length;
    },
    { message: 'Duplicate purity + size in weightRules.puritySizeRules', path: ['weightRules', 'puritySizeRules'] },
  );

// Combined-save shape for Purity Pricing Rules — same reasoning as
// weightRulesInputSchema: keyed by purity code, resolved to a purityValueId
// server-side. Unlike weightRulesInputSchema this is a bare array (no
// "purityRules"/"puritySizeRules" split — Purity Pricing Rules has no size
// dimension), so its own duplicate check + .optional() live directly here
// rather than needing a wrapper object.
const purityPricingRulesInputSchema = z
  .array(
    z.object({
      purity: z.enum(PURITIES),
      makingChargePercent: percent,
      makingChargeDiscountPercent: percent,
      stoneDiscountPercent: percent,
    }),
  )
  .refine(
    (rules) => {
      const keys = rules.map((r) => r.purity);
      return new Set(keys).size === keys.length;
    },
    { message: 'Duplicate purity in purityPricingRules' },
  );

export const listProductsQuerySchema = z.object({
  category: z.string().trim().optional(),
  collection: z.string().trim().optional(),
  metal: z.enum(METAL_TYPES).optional(),
  purity: z.enum(PURITIES).optional(),
  goldColor: z.enum(GOLD_COLORS).optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  sort: z.enum(['featured', 'newest', 'price_asc', 'price_desc', 'bestseller']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  // The homepage collection showcase's own "First 50" order (see
  // productsService.listPublicProducts).
  placement: z.enum(['homepage']).optional(),
});

export const adminListProductsQuerySchema = listProductsQuerySchema.extend({
  status: z.enum(STATUSES).optional(),
  // Free-text match on name/SKU (see products.repository.js's buildFilters)
  // — admin-only for now, the public storefront has its own dedicated
  // /search endpoint instead of filtering the listing endpoint.
  search: z.string().trim().min(1).max(200).optional(),
  // Admin already has the collection's real id in hand (from
  // /admin/collections) when listing "products in this collection" — a raw
  // id is simpler and one round-trip fewer than the public listing's
  // slug-based `collection` param above, which exists for the storefront's
  // URL-driven /collections/:slug page instead.
  collectionId: z.string().uuid().optional(),
});

// Split from createProductSchema/updateProductSchema below so .partial() can
// still be called on a plain ZodObject — .superRefine()/.refine() return a
// ZodEffects, which has no .partial() method, so the cross-field check must
// be layered on AFTER partial() is applied for the update variant, not
// baked into one shared schema both are derived from via refinement.
const productObjectSchema = z.object({
  name: z.string().trim().min(1).max(300),
  sku: z.string().trim().min(1).max(100),
  categoryId: z.string().uuid().nullable().optional(),
  collectionId: z.string().uuid().nullable().optional(),
  shortDescription: z.string().trim().max(500).nullable().optional(),
  fullDescription: z.string().trim().max(10000).nullable().optional(),

  goldColor: z.enum(GOLD_COLORS).nullable().optional(),
  goldWeightGrams: z.coerce.number().positive().nullable().optional(),
  certification: z.string().trim().max(200).nullable().optional(),
  productSize: z.string().trim().max(100).nullable().optional(),
  // Overrides the storefront/admin wording for the Size axis (e.g. "Length"
  // for a chain) — null means "Size", the default for every product today.
  sizeLabel: z.string().trim().max(50).nullable().optional(),
  careInstructions: z.string().trim().max(2000).nullable().optional(),

  goldValue: z.coerce.number().nonnegative().optional(),
  makingCharge: z.coerce.number().nonnegative().optional(),
  makingChargePercent: z.coerce.number().min(0).max(100).nullable().optional(),
  gstPercent: z.coerce.number().nonnegative().optional(),
  mrp: z.coerce.number().nonnegative().optional(),
  sellingPrice: z.coerce.number().nonnegative().optional(),
  makingChargeDiscountPercent: z.coerce.number().min(0).max(100).optional(),
  stoneDiscountPercent: z.coerce.number().min(0).max(100).optional(),

  stockQuantity: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(STATUSES).optional(),
  isFeatured: z.boolean().optional(),
  showDeliveryChecker: z.boolean().optional(),
  isNonReturnable: z.boolean().optional(),

  slug: z.string().trim().min(1).max(300).optional(),
  metaTitle: z.string().trim().max(300).nullable().optional(),
  metaDescription: z.string().trim().max(500).nullable().optional(),
  metaKeywords: z.string().trim().max(500).nullable().optional(),

  sizes: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(50),
        stockQuantity: z.coerce.number().int().nonnegative(),
        weightGrams: z.coerce.number().positive().nullable().optional(),
      }),
    )
    .optional(),

  goldColors: z.array(z.enum(GOLD_COLORS)).optional(),

  // The piece's stones — each line a stone type from Admin → Stone Types
  // with its count, total weight (carats) and price, all entered by hand.
  // Sent as the full list (replaces whatever was saved); absent on an
  // update = leave the saved stones untouched.
  stones: z
    .array(
      z.object({
        stoneTypeId: z.string().uuid(),
        count: z.coerce.number().int().positive(),
        weightCarats: z.coerce.number().positive(),
        price: z.coerce.number().nonnegative(),
      }),
    )
    .max(50)
    .optional(),

  // Per-exact-combination overrides, applied in the same save that sets up
  // the axes above — lets a brand-new product be fully configured (stock/
  // weight/availability per combination) without a separate trip back into
  // the variant editor afterward.
  variantOverrides: z
    .array(
      z.object({
        attributeValues: z.object({
          goldColor: z.enum(GOLD_COLORS).optional(),
          purity: z.enum(PURITIES).optional(),
          sizeLabel: z.string().optional(),
        }),
        stockQuantity: z.coerce.number().int().nonnegative().optional(),
        goldWeightGrams: z.coerce.number().positive().nullable().optional(),
        isAvailable: z.boolean().optional(),
        priceOverride: z.coerce.number().nonnegative().nullable().optional(),
      }),
    )
    .optional(),

  // Combined product create/edit save — Weight Defaults and Purity Pricing
  // Rules entered in the same form, before the product's own attribute_value
  // rows exist yet. Both optional and deliberately NOT defaulted at this
  // level: an absent key means "don't touch the saved rules" on an update
  // (see productsService.js's adminUpdateProduct), distinct from an
  // explicitly-sent empty collection, which means "clear them". Only
  // .default([]) inside weightRulesInputSchema's own two array fields, and
  // that only applies once the `weightRules` object itself is present.
  weightRules: weightRulesInputSchema.optional(),
  purityPricingRules: purityPricingRulesInputSchema.optional(),
});

// A size referenced by weightRules must be one of the sizes this same
// request is selecting — but only checked when `sizes` is actually present
// in this request. A partial update that edits only weightRules without
// touching sizes has nothing here to check against; the service layer's own
// resolver (productsService.js's buildPurityAndSizeResolver) throws a 409
// against the product's actual saved attribute catalogue in that case
// instead. (Purity needs no check: the PURITIES enum only admits 9K, which
// every product carries.)
function checkAxisMembership(input, ctx) {
  const sizeLabels = input.sizes?.map((s) => s.label);

  if (input.weightRules && sizeLabels) {
    input.weightRules.puritySizeRules.forEach((r, i) => {
      if (!sizeLabels.includes(r.sizeLabel)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Size ${r.sizeLabel} is not in the selected sizes`,
          path: ['weightRules', 'puritySizeRules', i, 'sizeLabel'],
        });
      }
    });
  }
}

export const createProductSchema = productObjectSchema.superRefine(checkAxisMembership);
export const updateProductSchema = productObjectSchema.partial().superRefine(checkAxisMembership);

export const featuredSchema = z.object({
  featured: z.boolean(),
});

export const bestSellerSchema = z.object({
  bestSeller: z.boolean(),
});

// Product list bulk action: put many products into one collection at once
// (collectionId null = remove them from any collection).
export const bulkCollectionSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(500),
  collectionId: z.string().uuid().nullable(),
});

export const variantPricePreviewQuerySchema = z.object({
  variantId: z.string().uuid().optional(),
});

export const updateVariantSchema = z.object({
  stockQuantity: z.coerce.number().int().nonnegative().optional(),
  goldWeightGrams: z.coerce.number().positive().nullable().optional(),
  isAvailable: z.boolean().optional(),
  sku: z.string().trim().max(100).nullable().optional(),
  priceOverride: z.coerce.number().nonnegative().nullable().optional(),
});

// Same field set, applied to many variants at once — the bulk-edit toolbar
// on the Advanced Variant Management table.
export const bulkUpdateVariantSchema = z.object({
  variantIds: z.array(z.string().uuid()).min(1),
  fields: updateVariantSchema.omit({ sku: true }),
});
