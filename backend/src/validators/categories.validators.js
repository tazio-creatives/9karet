import { z } from 'zod';

export const createCategorySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  isNonReturnable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  bannerEnabled: z.boolean().optional(),
  bannerEyebrow: z.string().trim().max(200).nullable().optional(),
  bannerDescription: z.string().trim().max(500).nullable().optional(),
  bannerImageUrl: z.string().trim().max(500).nullable().optional(),
  bannerImageUrlMobile: z.string().trim().max(500).nullable().optional(),
  bannerAltText: z.string().trim().max(300).nullable().optional(),
  bannerTextColor: z.enum(['LIGHT', 'DARK']).optional(),
  bannerTextPosition: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional(),
  bannerFocalPosition: z.enum(['LEFT', 'CENTER', 'RIGHT']).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();
