import { apiFetch } from './client';

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  authorName: string | null;
  publishedAt: string | null;
  updatedAt: string;
  readMinutes: number;
}

export interface BlogPostDetail extends BlogPostSummary {
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface BlogListResponse {
  posts: BlogPostSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const BLOG_PAGE_SIZE = 12;

// Query keys shared with seo/prefetch.ts — must match exactly for SSR
// hydration to reuse the server-fetched data.
export const blogListQueryKey = (page: number) => ['blog-posts', page] as const;
export const blogPostQueryKey = (slug: string) => ['blog-post', slug] as const;

export function fetchBlogPosts(page = 1) {
  return apiFetch<BlogListResponse>(`/blog?page=${page}&limit=${BLOG_PAGE_SIZE}`);
}

export function fetchBlogPost(slug: string) {
  return apiFetch<{ post: BlogPostDetail; morePosts: BlogPostSummary[] }>(`/blog/${encodeURIComponent(slug)}`);
}

export function fetchBlogSitemap() {
  return apiFetch<{ posts: { slug: string; updatedAt: string }[] }>('/blog/sitemap');
}

export function formatBlogDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}
