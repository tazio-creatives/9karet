import { apiFetch } from './client';
import type { ProductDetail, ProductInput, ProductListItem, ProductStatus } from './types';

export interface ListProductsParams {
  status?: ProductStatus;
  category?: string;
  collectionId?: string;
  metal?: string;
  purity?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ProductListResponse {
  products: ProductListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function fetchAdminProducts(params: ListProductsParams) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const suffix = qs.toString();
  return apiFetch<ProductListResponse>(`/admin/products${suffix ? `?${suffix}` : ''}`);
}

export function fetchAdminProduct(id: string) {
  return apiFetch<{ product: ProductDetail }>(`/admin/products/${id}`);
}

export function createProduct(input: ProductInput) {
  return apiFetch<{ product: ProductDetail }>('/admin/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProduct(id: string, input: Partial<ProductInput>) {
  return apiFetch<{ product: ProductDetail }>(`/admin/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteProduct(id: string) {
  return apiFetch<void>(`/admin/products/${id}`, { method: 'DELETE' });
}

export function setPriceLock(id: string, locked: boolean) {
  return apiFetch<{ id: string; isPriceLocked: boolean }>(`/admin/products/${id}/price-lock`, {
    method: 'PATCH',
    body: JSON.stringify({ locked }),
  });
}

export function setFeatured(id: string, featured: boolean) {
  return apiFetch<{ id: string; isFeatured: boolean }>(`/admin/products/${id}/featured`, {
    method: 'PATCH',
    body: JSON.stringify({ featured }),
  });
}

// Put many products into one collection at once (null removes them from
// their collection). A product is in at most one collection.
export function bulkSetCollection(productIds: string[], collectionId: string | null) {
  return apiFetch<{ updated: number; notFound: number }>('/admin/products/bulk-collection', {
    method: 'POST',
    body: JSON.stringify({ productIds, collectionId }),
  });
}

export function setBestSeller(id: string, bestSeller: boolean) {
  return apiFetch<{ id: string; isBestSeller: boolean }>(`/admin/products/${id}/best-seller`, {
    method: 'PATCH',
    body: JSON.stringify({ bestSeller }),
  });
}

export interface ProductVariantRow {
  id: string;
  label: string;
  isAvailable: boolean;
  stockQuantity: number;
  goldWeightGrams: number | null;
  diamondWeightGrams: number | null;
  diamondWeightCarats: number | null;
  sellingPrice: number;
  priceOverride: number | null;
  isPriceOverridden: boolean;
  attributeValueIds: string[];
  excludedByRuleId: string | null;
}

export interface ProductVariantInput {
  stockQuantity?: number;
  goldWeightGrams?: number | null;
  diamondWeightGrams?: number | null;
  diamondWeightCarats?: number | null;
  isAvailable?: boolean;
  priceOverride?: number | null;
}

export function fetchProductVariants(productId: string) {
  return apiFetch<{ variants: ProductVariantRow[] }>(`/admin/products/${productId}/variants`);
}

export function updateProductVariant(productId: string, variantId: string, input: ProductVariantInput) {
  return apiFetch<{ variant: ProductVariantRow }>(`/admin/products/${productId}/variants/${variantId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function bulkUpdateProductVariants(
  productId: string,
  variantIds: string[],
  fields: Omit<ProductVariantInput, 'stockQuantity'> & { stockQuantity?: number },
) {
  return apiFetch<{ variants: ProductVariantRow[] }>(`/admin/products/${productId}/variants/bulk`, {
    method: 'PATCH',
    body: JSON.stringify({ variantIds, fields }),
  });
}
