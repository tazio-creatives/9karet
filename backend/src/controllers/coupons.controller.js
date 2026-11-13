import { applyCouponSchema } from '../validators/coupons.validators.js';
import { validateCoupon } from '../services/couponService.js';

export async function apply(req, res, next) {
  try {
    const { code, subtotal } = applyCouponSchema.parse(req.body);
    const { coupon, discountAmount } = await validateCoupon(code, req.customer.id, subtotal);
    res.json({
      coupon: { code: coupon.code, discountType: coupon.discount_type, discountValue: Number(coupon.discount_value) },
      discountAmount,
    });
  } catch (err) {
    next(err);
  }
}
