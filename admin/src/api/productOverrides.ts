import { apiFetch } from './client';
import type { ProductOverride, ProductOverrideBulkAction } from './types';

export interface FetchProductOverridesParams {
  search?: string;
  categoryId?: string;
  hasMakingOverride?: boolean;
  hasStoneOverride?: boolean;
  page?: number;
  limit?: number;
}

export function fetchProductOverrides(params: FetchProductOverridesParams = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.hasMakingOverride != null) qs.set('hasMakingOverride', String(params.hasMakingOverride));
  if (params.hasStoneOverride != null) qs.set('hasStoneOverride', String(params.hasStoneOverride));
  qs.set('page', String(params.page ?? 1));
  qs.set('limit', String(params.limit ?? 25));
  return apiFetch<{ overrides: ProductOverride[]; total: number; page: number; limit: number }>(
    `/admin/pricing/product-overrides?${qs.toString()}`,
  );
}

export function bulkProductOverrideAction(input: { productIds: string[]; action: ProductOverrideBulkAction; confirmed: true }) {
  return apiFetch<{ repriceJobId: string | null; restoredCount?: number; skippedCount?: number }>(
    '/admin/pricing/product-overrides/bulk',
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}
