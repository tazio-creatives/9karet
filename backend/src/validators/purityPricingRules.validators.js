import { z } from 'zod';

// Each of the three fields is independently nullable — null means "inherit
// the product-level default for this one field", 0 means "explicit zero".
// z.coerce.number() would turn null into NaN, so percent fields are plain
// z.number() wrapped in .nullable(), matching how weightRules keeps
// goldWeightGrams strictly required-and-positive but this feature needs the
// opposite: absence must survive all the way to the database as NULL, never
// coerced to 0.
const percent = z.number().min(0).max(100).nullable().optional().default(null);

// Making charge is a % of the gold value — on 9K gold it can exceed 100%, so
// it has no 100% cap; only the column's own range (NUMERIC(7,2)) bounds it.
// The two discount percents stay capped at 100%.
const makingChargePercent = z.number().min(0).max(99999.99).nullable().optional().default(null);

export const replacePurityPricingRulesSchema = z
  .object({
    purityPricingRules: z
      .array(
        z.object({
          purityValueId: z.string().uuid(),
          makingChargePercent,
          makingChargeDiscountPercent: percent,
          stoneDiscountPercent: percent,
        }),
      )
      .default([]),
  })
  .refine(
    (input) => {
      const ids = input.purityPricingRules.map((r) => r.purityValueId);
      return new Set(ids).size === ids.length;
    },
    { message: 'Duplicate purity in purityPricingRules', path: ['purityPricingRules'] },
  );
