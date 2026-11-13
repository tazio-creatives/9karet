import { z } from 'zod';

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateCollectionSchema = createCollectionSchema.partial();
