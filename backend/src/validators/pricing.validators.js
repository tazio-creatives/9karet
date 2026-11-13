import { z } from 'zod';

export const pricingPreviewSchema = z.object({
  goldWeightGrams: z.coerce.number().positive().nullable().optional(),
  stones: z.array(z.object({ price: z.coerce.number().nonnegative() })).optional(),
  makingCharge: z.coerce.number().nonnegative().optional(),
  gstPercent: z.coerce.number().nonnegative().optional(),
});

export const priceLockSchema = z.object({
  locked: z.boolean(),
});

export const goldRateSettingsSchema = z.object({
  source: z.enum(['AUTOMATIC', 'MANUAL']).optional(),
  adjustmentType: z.enum(['NONE', 'FIXED', 'PERCENTAGE']).optional(),
  adjustmentValue: z.coerce.number().optional(),
  maxDeviationPercent: z.coerce.number().positive().optional(),
});

export const manualGoldRateSchema = z.object({
  rate24k: z.coerce.number().positive(),
});
