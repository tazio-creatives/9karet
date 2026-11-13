import {
  createCouponSchema,
  updateCouponSchema,
  listCouponsQuerySchema,
} from '../validators/coupons.validators.js';
import {
  insertCoupon,
  updateCoupon,
  findCouponById,
  listCoupons,
  countCouponUsageTotal,
} from '../repositories/coupons.repository.js';
import { NotFoundError, AppError } from '../utils/AppError.js';

function toCouponDto(row, usageCount) {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    minOrderValue: Number(row.min_order_value),
    usageLimitTotal: row.usage_limit_total,
    usageLimitPerUser: row.usage_limit_per_user,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    usageCount: usageCount ?? null,
    createdAt: row.created_at,
  };
}

export async function list(req, res, next) {
  try {
    const q = listCouponsQuerySchema.parse(req.query);
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const { items, total } = await listCoupons({ page, limit });
    res.json({
      coupons: items.map((row) => toCouponDto(row)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function get(req, res, next) {
  try {
    const coupon = await findCouponById(req.params.id);
    if (!coupon) throw new NotFoundError('Coupon not found');
    const usageCount = await countCouponUsageTotal(coupon.id);
    res.json({ coupon: toCouponDto(coupon, usageCount) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const input = createCouponSchema.parse(req.body);
    const coupon = await insertCoupon(input);
    res.status(201).json({ coupon: toCouponDto(coupon) });
  } catch (err) {
    if (err.code === '23505') return next(new AppError(409, 'A coupon with this code already exists'));
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const input = updateCouponSchema.parse(req.body);
    const existing = await findCouponById(req.params.id);
    if (!existing) throw new NotFoundError('Coupon not found');
    const coupon = await updateCoupon(req.params.id, input);
    res.json({ coupon: toCouponDto(coupon) });
  } catch (err) {
    next(err);
  }
}
