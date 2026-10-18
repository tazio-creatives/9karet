import { apiFetch, ApiError } from './client';
import type { Category, CategoryInput } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export function fetchAdminCategories() {
  return apiFetch<{ categories: Category[] }>('/admin/categories');
}

// Multipart upload — can't go through the JSON-only apiFetch helper, same
// pattern as api/homepage.ts's uploadHomepageImage.
export async function uploadCategoryImage(file: File) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${API_BASE_URL}/admin/categories/upload-image`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': '9karet' },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error?.message ?? response.statusText, body.error?.fields);
  }
  return response.json() as Promise<{ url: string }>;
}

export function createCategory(input: Partial<CategoryInput>) {
  return apiFetch<{ category: Category }>('/admin/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCategory(id: string, input: Partial<CategoryInput>) {
  return apiFetch<{ category: Category }>(`/admin/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteCategory(id: string) {
  return apiFetch<void>(`/admin/categories/${id}`, { method: 'DELETE' });
}
