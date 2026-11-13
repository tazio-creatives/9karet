import { apiFetch } from './client';
import type { AdminReview, ReviewStatus } from './types';

export interface AdminReviewListResponse {
  reviews: AdminReview[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function fetchAdminReviews(status?: ReviewStatus, page = 1, limit = 20) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) qs.set('status', status);
  return apiFetch<AdminReviewListResponse>(`/admin/reviews?${qs.toString()}`);
}

export function approveReview(id: string) {
  return apiFetch<{ review: { id: string; status: string } }>(`/admin/reviews/${id}/approve`, {
    method: 'POST',
  });
}

export function rejectReview(id: string) {
  return apiFetch<{ review: { id: string; status: string } }>(`/admin/reviews/${id}/reject`, {
    method: 'POST',
  });
}

export function resetReviewToPending(id: string) {
  return apiFetch<{ review: { id: string; status: string } }>(`/admin/reviews/${id}/reset-to-pending`, {
    method: 'POST',
  });
}
