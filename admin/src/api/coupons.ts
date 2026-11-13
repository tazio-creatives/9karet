import { apiFetch } from './client';
import type { Coupon, CouponInput } from './types';

export interface CouponListResponse {
  coupons: Coupon[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function fetchAdminCoupons(page = 1, limit = 20) {
  return apiFetch<CouponListResponse>(`/admin/coupons?page=${page}&limit=${limit}`);
}

export function createCoupon(input: CouponInput) {
  return apiFetch<{ coupon: Coupon }>('/admin/coupons', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCoupon(id: string, input: CouponInput) {
  return apiFetch<{ coupon: Coupon }>(`/admin/coupons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
