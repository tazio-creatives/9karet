import { apiFetch } from './client';
import type {
  GoldColor,
  MetalType,
  ProductCard,
  ProductDetail,
  ProductListResponse,
  Purity,
  SortOption,
  VariantPricePreview,
} from './types';

export interface ListProductsParams {
  category?: string;
  collection?: string;
  metal?: MetalType;
  purity?: Purity;
  goldColor?: GoldColor;
  priceMin?: number;
  priceMax?: number;
  sort?: SortOption;
  page?: number;
  limit?: number;
  // 'homepage' = use the homepage collection showcase's own admin-set order.
  placement?: 'homepage';
}

export function fetchProducts(params: ListProductsParams) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  }
  const suffix = qs.toString();
  return apiFetch<ProductListResponse>(`/products${suffix ? `?${suffix}` : ''}`);
}

export function fetchProductBySlug(slug: string) {
  return apiFetch<{ product: ProductDetail }>(`/products/${slug}`);
}

export function fetchRelatedProducts(slug: string) {
  return apiFetch<{ products: ProductCard[] }>(`/products/${slug}/related`);
}

export function fetchMostLovedProducts(slug: string) {
  return apiFetch<{ products: ProductCard[] }>(`/products/${slug}/most-loved`);
}

export function fetchVariantPricePreview(productId: string, selection: { variantId: string }) {
  const qs = new URLSearchParams({ variantId: selection.variantId });
  return apiFetch<VariantPricePreview>(`/products/${productId}/price-preview?${qs.toString()}`);
}
