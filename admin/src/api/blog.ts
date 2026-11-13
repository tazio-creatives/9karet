import { apiFetch, ApiError } from './client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export type BlogPostStatus = 'DRAFT' | 'PUBLISHED';

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  authorName: string | null;
  status: BlogPostStatus;
  publishedAt: string | null;
  updatedAt: string;
  readMinutes: number;
}

export interface BlogPost extends BlogPostSummary {
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
}

export interface BlogPostInput {
  title: string;
  slug?: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  content: string;
  authorName: string | null;
  status: BlogPostStatus;
  publishedAt?: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export function fetchAdminBlogPosts(params: { status?: BlogPostStatus; search?: string; page?: number }) {
  const qs = new URLSearchParams({ page: String(params.page ?? 1), limit: '20' });
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  return apiFetch<{ posts: BlogPostSummary[]; page: number; totalPages: number; total: number }>(
    `/admin/blog?${qs.toString()}`,
  );
}

export function fetchAdminBlogPost(id: string) {
  return apiFetch<{ post: BlogPost }>(`/admin/blog/${id}`);
}

export function createBlogPost(input: BlogPostInput) {
  return apiFetch<{ post: BlogPost }>('/admin/blog', { method: 'POST', body: JSON.stringify(input) });
}

export function updateBlogPost(id: string, input: Partial<BlogPostInput>) {
  return apiFetch<{ post: BlogPost }>(`/admin/blog/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteBlogPost(id: string) {
  return apiFetch<void>(`/admin/blog/${id}`, { method: 'DELETE' });
}

// Multipart upload — same pattern as api/categories.ts's uploadCategoryImage.
export async function uploadBlogImage(file: File) {
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch(`${API_BASE_URL}/admin/blog/upload-image`, {
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
