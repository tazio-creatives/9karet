import { z } from 'zod';

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().max(5000).nullable().optional(),
  orderItemId: z.string().uuid(),
});

// multer parses a repeated multipart field into an array, but a single
// occurrence into a bare string — normalize both shapes to an array.
const stringArrayField = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]));

export const updateReviewSchema = createReviewSchema.omit({ orderItemId: true }).extend({
  // Which of the review's existing photo URLs to keep — undefined means
  // "images weren't touched, leave them as-is"; present (even []) means the
  // customer explicitly reviewed their photos, so reconcile against it.
  keepImageUrls: stringArrayField,
});

export const listReviewsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const listModerationQuerySchema = listReviewsQuerySchema.extend({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});
