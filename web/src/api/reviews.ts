import { apiFetch } from './client';
import type { ReviewInput, ReviewListResponse } from './types';

export function fetchReviews(productId: string, page = 1, limit = 10) {
  return apiFetch<ReviewListResponse>(`/products/${productId}/reviews?page=${page}&limit=${limit}`);
}

// multipart/form-data (like the return-request video upload) — images are
// optional, client.ts skips the JSON Content-Type header for a FormData
// body and lets fetch set its own multipart boundary.
function toReviewFormData(input: {
  rating: number;
  title?: string | null;
  body?: string | null;
  orderItemId?: string;
  images?: File[];
  keepImageUrls?: string[];
}) {
  const body = new FormData();
  body.set('rating', String(input.rating));
  if (input.title) body.set('title', input.title);
  if (input.body) body.set('body', input.body);
  if (input.orderItemId) body.set('orderItemId', input.orderItemId);
  for (const image of input.images ?? []) body.append('images', image);
  // Present-but-empty must still reach the server as an explicit [] (not
  // "field absent") — see updateReview's keepImageUrls contract, so this
  // always appends the field when the caller passed it, even for [].
  if (input.keepImageUrls) {
    if (input.keepImageUrls.length === 0) body.append('keepImageUrls', '');
    else for (const url of input.keepImageUrls) body.append('keepImageUrls', url);
  }
  return body;
}

export function submitReview(productId: string, input: ReviewInput) {
  return apiFetch<{ review: { id: string; status: string; images: string[] } }>(
    `/products/${productId}/reviews`,
    { method: 'POST', body: toReviewFormData(input) },
  );
}

export function updateReview(
  reviewId: string,
  input: {
    rating: number;
    title?: string | null;
    body?: string | null;
    images?: File[];
    keepImageUrls?: string[];
  },
) {
  return apiFetch<{ review: { id: string; status: string; images?: string[] } }>(`/reviews/${reviewId}`, {
    method: 'PATCH',
    body: toReviewFormData(input),
  });
}
