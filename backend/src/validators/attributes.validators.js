import { z } from 'zod';

export const createAttributeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z][a-z0-9_]*$/, 'Code must be lowercase letters, numbers, and underscores only'),
  name: z.string().trim().min(1).max(100),
  sortOrder: z.coerce.number().int().optional(),
});

export const updateAttributeSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const createAttributeValueSchema = z.object({
  value: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(150),
  sortOrder: z.coerce.number().int().optional(),
});

export const updateAttributeValueSchema = z.object({
  label: z.string().trim().min(1).max(150).optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});
