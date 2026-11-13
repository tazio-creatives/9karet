import { apiFetch } from './client';

export interface AiImageCandidate {
  id: string;
  imageUrl: string;
  approved: boolean;
  metadata: Record<string, unknown>;
}

export interface AiImageJob {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  error: string | null;
  candidates: AiImageCandidate[];
}

export function fetchAiImageStatus(productId: string) {
  return apiFetch<{ job: AiImageJob | null }>(`/admin/products/${productId}/ai-images`);
}

export function regenerateAiImages(productId: string) {
  return apiFetch<{ aiImageJobId: string }>(`/admin/products/${productId}/ai-images/regenerate`, {
    method: 'POST',
  });
}

export function approveAiImage(productId: string, imageId: string) {
  return apiFetch<{ images: unknown[] }>(`/admin/products/${productId}/ai-images/${imageId}/approve`, {
    method: 'POST',
  });
}

export function rejectAiImage(productId: string, imageId: string) {
  return apiFetch<void>(`/admin/products/${productId}/ai-images/${imageId}/reject`, {
    method: 'POST',
  });
}
