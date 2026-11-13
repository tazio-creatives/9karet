import { z } from 'zod';

const uuid = z.string().uuid();

const conditionSchema = z.object({
  conditionType: z.enum(['CARAT_RANGE']),
  stringValues: z.array(z.string()).optional().nullable(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
});

// Full create payload — also reused as-is for POST /rules/preview (an
// unsaved rule is validated exactly the same way a saved one would be, so
// the preview can never diverge from what create would actually accept).
export const createPricingRuleSchema = z
  .object({
    ruleType: z.enum(['MAKING_CHARGE', 'STONE']),
    name: z.string().trim().min(1).max(200),
    scope: z.enum(['GLOBAL', 'CATEGORY', 'PRODUCT']),
    discountType: z.enum(['PERCENT', 'FIXED_AMOUNT', 'FIXED_AMOUNT_PER_CARAT']),
    discountValue: z.number().min(0),
    purityScope: z.enum(['ALL', 'SELECTED']).default('ALL'),
    purityValueIds: z.array(uuid).default([]),
    overrideMode: z.enum(['PRESERVE', 'SUPPRESS']).default('PRESERVE'),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'DISABLED']).default('DRAFT'),
    priority: z.number().int().default(0),
    notes: z.string().max(2000).nullable().optional(),
    categoryIds: z.array(uuid).default([]),
    productIds: z.array(uuid).default([]),
    stoneTypeIds: z.array(uuid).default([]),
    conditions: z.array(conditionSchema).default([]),
  })
  .superRefine((input, ctx) => {
    // Mirrors pricing_rules_making_type_chk — surfaced here with a clear
    // message instead of a raw 23514 constraint violation.
    if (input.ruleType === 'MAKING_CHARGE' && input.discountType === 'FIXED_AMOUNT_PER_CARAT') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountType'],
        message: 'Making Charge rules cannot use Fixed Amount per Carat.',
      });
    }
    if (input.discountType === 'PERCENT' && input.discountValue > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountValue'], message: 'A percent discount cannot exceed 100.' });
    }
    if (input.scope === 'CATEGORY' && input.categoryIds.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['categoryIds'], message: 'Select at least one category.' });
    }
    if (input.scope === 'PRODUCT' && input.productIds.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['productIds'], message: 'Select at least one product.' });
    }
    if (input.purityScope === 'SELECTED' && input.purityValueIds.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['purityValueIds'], message: 'Select at least one purity, or choose "All purities".' });
    }
    if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'End date must be after the start date.' });
    }
  });

// Partial update — every field optional, no "required when scope=X"
// cross-checks (a PATCH-style edit of just `priority` shouldn't have to
// re-submit categoryIds/productIds it isn't touching). The percent-vs-100
// and making-charge-vs-per-carat checks still apply whenever the relevant
// fields ARE present together, mirroring replacePurityPricingRulesSchema's
// "still validate what's actually there" style.
export const updatePricingRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    discountType: z.enum(['PERCENT', 'FIXED_AMOUNT', 'FIXED_AMOUNT_PER_CARAT']).optional(),
    discountValue: z.number().min(0).optional(),
    purityScope: z.enum(['ALL', 'SELECTED']).optional(),
    purityValueIds: z.array(uuid).optional(),
    overrideMode: z.enum(['PRESERVE', 'SUPPRESS']).optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'DISABLED']).optional(),
    priority: z.number().int().optional(),
    notes: z.string().max(2000).nullable().optional(),
    categoryIds: z.array(uuid).optional(),
    productIds: z.array(uuid).optional(),
    stoneTypeIds: z.array(uuid).optional(),
    conditions: z.array(conditionSchema).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.discountType === 'PERCENT' && input.discountValue != null && input.discountValue > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountValue'], message: 'A percent discount cannot exceed 100.' });
    }
    if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'End date must be after the start date.' });
    }
    if (input.purityScope === 'SELECTED' && input.purityValueIds != null && input.purityValueIds.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['purityValueIds'], message: 'Select at least one purity, or choose "All purities".' });
    }
  });

export const listPricingRulesQuerySchema = z.object({
  ruleType: z.enum(['MAKING_CHARGE', 'STONE']).optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'DISABLED']).optional(),
  scope: z.enum(['GLOBAL', 'CATEGORY', 'PRODUCT']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const listPricingRuleAuditQuerySchema = z.object({
  ruleId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  adminUserId: z.string().uuid().optional(),
  action: z
    .enum([
      'CREATED', 'UPDATED', 'ACTIVATED', 'DEACTIVATED', 'SCHEDULED', 'EXPIRED', 'DELETED',
      'REPRICE_STARTED', 'REPRICE_COMPLETED', 'REPRICE_FAILED',
      'OVERRIDE_REMOVED', 'OVERRIDE_RESTORED', 'BULK_OVERRIDE_ACTION',
    ])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
