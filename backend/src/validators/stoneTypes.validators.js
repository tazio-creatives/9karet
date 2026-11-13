import { z } from 'zod';

export const createStoneTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const updateStoneTypeSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
