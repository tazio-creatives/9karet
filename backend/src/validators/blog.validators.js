import { z } from 'zod';

const nullableText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));

const postFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  // Optional — derived from the title when omitted (see blogService).
  slug: z
    .string()
    .trim()
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  excerpt: nullableText(400),
  coverImageUrl: nullableText(1000),
  coverImageAlt: nullableText(200),
  content: z.string().max(100_000).default(''),
  authorName: nullableText(120),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  publishedAt: z.string().datetime().nullable().optional(),
  seoTitle: nullableText(200),
  seoDescription: nullableText(320),
};

export const createBlogPostSchema = z.object(postFields);

export const updateBlogPostSchema = z
  .object({
    ...postFields,
    title: postFields.title.optional(),
    content: z.string().max(100_000).optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const listPublicBlogQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(48).optional(),
});

export const listAdminBlogQuerySchema = listPublicBlogQuerySchema.extend({
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
