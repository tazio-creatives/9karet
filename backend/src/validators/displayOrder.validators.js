import { z } from 'zod';

export const PLACEMENT_TYPES = ['homepage_collection', 'category'];
export const MAX_DISPLAY_ORDER_PRODUCTS = 50;

export const placementParamsSchema = z.object({
  placementType: z.enum(PLACEMENT_TYPES),
  placementId: z.string().uuid(),
});

export const saveDisplayOrderSchema = z.object({
  productIds: z
    .array(z.string().uuid())
    .max(MAX_DISPLAY_ORDER_PRODUCTS, `You can select at most ${MAX_DISPLAY_ORDER_PRODUCTS} products`)
    .refine((ids) => new Set(ids).size === ids.length, 'A product can only appear once in the order'),
});

export const searchPlacementProductsSchema = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});
