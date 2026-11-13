import { AppError, NotFoundError } from '../utils/AppError.js';
import {
  findCouponByCode,
  countCouponUsageTotal,
  countCouponUsageForUser,
} from '../repositories/coupons.repository.js';

function round2(n) {
  return Math.round(n * 100) / 100;
}

function computeDiscount(coupon, subtotal) {
  if (coupon.discount_type === 'PERCENT') {
    return round2((subtotal * Number(coupon.discount_value)) / 100);
  }
  return round2(Math.min(Number(coupon.discount_value), subtotal));
}

// Shared by the public preview endpoint (POST /coupons/apply) and checkout
// itself — both need the exact same eligibility rules and discount math, so
// there is exactly one place that can go out of sync between "what the
// shopper was shown" and "what checkout actually charged."
export async function validateCoupon(code, userId, subtotal) {
  const coupon = await findCouponByCode(code.trim().toUpperCase());
  if (!coupon || !coupon.is_active) throw new NotFoundError('Coupon not found');

  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    throw new AppError(400, 'This coupon is not active yet');
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < now) {
    throw new AppError(400, 'This coupon has expired');
  }
  if (Number(subtotal) < Number(coupon.min_order_value)) {
    throw new AppError(400, `This coupon requires a minimum order of ${coupon.min_order_value}`);
  }

  if (coupon.usage_limit_total != null) {
    const totalUsed = await countCouponUsageTotal(coupon.id);
    if (totalUsed >= coupon.usage_limit_total) {
      throw new AppError(400, 'This coupon has reached its usage limit');
    }
  }

  const userUsed = await countCouponUsageForUser(coupon.id, userId);
  if (userUsed >= coupon.usage_limit_per_user) {
    throw new AppError(400, "You've already used this coupon the maximum number of times");
  }

  const discountAmount = computeDiscount(coupon, Number(subtotal));
  return { coupon, discountAmount };
}
