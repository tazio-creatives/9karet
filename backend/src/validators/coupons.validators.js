import { z } from 'zod';

export const applyCouponSchema = z.object({
  code: z.string().trim().min(1).max(50),
  subtotal: z.coerce.number().nonnegative(),
});

const couponBaseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .transform((v) => v.toUpperCase()),
  discountType: z.enum(['PERCENT', 'FLAT']),
  discountValue: z.coerce.number().positive(),
  minOrderValue: z.coerce.number().nonnegative().optional(),
  usageLimitTotal: z.coerce.number().int().positive().nullable().optional(),
  usageLimitPerUser: z.coerce.number().int().positive().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
});

function refinePercentCap(schema) {
  return schema.refine(
    (v) => v.discountType !== 'PERCENT' || v.discountValue == null || v.discountValue <= 100,
    { message: 'Percent discounts cannot exceed 100', path: ['discountValue'] },
  );
}

export const createCouponSchema = refinePercentCap(couponBaseSchema);
export const updateCouponSchema = refinePercentCap(couponBaseSchema.partial().omit({ code: true }));

export const listCouponsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
