import { apiFetch, ApiError } from './client';
import type { HomepageItem, HomepageItemInput, HomepageSection, HomepageSectionType } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export function fetchHomepageSections() {
  return apiFetch<{ sections: HomepageSection[] }>('/admin/homepage');
}

// Multipart upload — can't go through the JSON-only apiFetch helper (the
// browser needs to set its own multipart boundary in Content-Type), same
// reasoning as api/productImages.ts's uploadProductImage.
export async function uploadHomepageImage(file: File) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${API_BASE_URL}/admin/homepage/upload-image`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'box-diamonds' },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error?.message ?? response.statusText, body.error?.fields);
  }
  return response.json() as Promise<{ url: string }>;
}

export function createSection(type: HomepageSectionType, heading?: string) {
  return apiFetch<{ section: HomepageSection }>('/admin/homepage/sections', {
    method: 'POST',
    body: JSON.stringify({ type, heading: heading || undefined }),
  });
}

export function updateSection(id: string, input: { heading?: string | null; isEnabled?: boolean }) {
  return apiFetch<{ section: HomepageSection }>(`/admin/homepage/sections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteSection(id: string) {
  return apiFetch<void>(`/admin/homepage/sections/${id}`, { method: 'DELETE' });
}

export function reorderSections(order: string[]) {
  return apiFetch<{ sections: HomepageSection[] }>('/admin/homepage/sections/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ order }),
  });
}

export function createItem(sectionId: string, input: HomepageItemInput) {
  return apiFetch<{ item: HomepageItem }>(`/admin/homepage/sections/${sectionId}/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateItem(id: string, input: HomepageItemInput) {
  return apiFetch<{ item: HomepageItem }>(`/admin/homepage/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteItem(id: string) {
  return apiFetch<void>(`/admin/homepage/items/${id}`, { method: 'DELETE' });
}

export function reorderItems(sectionId: string, order: string[]) {
  return apiFetch<{ items: HomepageItem[] }>(`/admin/homepage/sections/${sectionId}/items/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ order }),
  });
}
