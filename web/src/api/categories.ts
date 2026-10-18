import { apiFetch } from './client';
import type { Category, CategoryFilterCounts } from './types';

export function fetchCategories() {
  return apiFetch<{ categories: Category[] }>('/categories');
}

export function fetchCategoryBySlug(slug: string) {
  return apiFetch<{ category: Category }>(`/categories/${slug}`);
}

export function fetchCategoryFilterCounts(slug: string) {
  return apiFetch<CategoryFilterCounts>(`/categories/${slug}/counts`);
}

// Gold colours and purities switched on in Admin → Attributes — the only
// values the product-list filters offer.
export interface FilterOptions {
  goldColors: { value: string; label: string }[];
  purities: { value: string; label: string }[];
}

export function fetchFilterOptions() {
  return apiFetch<FilterOptions>('/filter-options');
}
