import { z } from 'zod';

const PURITIES = ['9K'];

export const replaceWeightRulesSchema = z.object({
  purityRules: z
    .array(z.object({ purity: z.enum(PURITIES), goldWeightGrams: z.coerce.number().positive() }))
    .default([]),
  puritySizeRules: z
    .array(
      z.object({
        purity: z.enum(PURITIES),
        sizeLabel: z.string().min(1),
        goldWeightGrams: z.coerce.number().positive(),
      }),
    )
    .default([]),
});
