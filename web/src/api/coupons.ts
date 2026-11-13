import { apiFetch } from './client';
import type { CouponApplyResponse } from './types';

export function applyCoupon(code: string, subtotal: number) {
  return apiFetch<CouponApplyResponse>('/coupons/apply', {
    method: 'POST',
    body: JSON.stringify({ code, subtotal }),
  });
}
