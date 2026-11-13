import { z } from 'zod';

export const createExclusionRuleSchema = z
  .object({
    attributeValueIdA: z.string().uuid(),
    attributeValueIdB: z.string().uuid(),
  })
  .refine((data) => data.attributeValueIdA !== data.attributeValueIdB, {
    message: 'A rule must be between two different values',
  });
