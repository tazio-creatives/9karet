import { apiFetch } from './client';

export type PlacementType = 'homepage_collection' | 'category';

export interface DisplayOrderProduct {
  productId: string;
  name: string | null;
  sku: string | null;
  imageUrl: string | null;
  sellingPrice: number;
  availableStock: number;
  status: string | null;
}

export interface DisplayOrderItem extends DisplayOrderProduct {
  position: number;
  // e.g. "Unpublished", "Out of category", "Invalid price", "Out of stock".
  warnings: string[];
  // True when the storefront skips it (any warning other than Out of stock).
  isHidden: boolean;
}

export interface DisplayOrderResponse {
  placement: { type: PlacementType; id: string; name: string; slug: string };
  items: DisplayOrderItem[];
  maxProducts: number;
}

export interface PlacementProductSearch {
  products: DisplayOrderProduct[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const base = (type: PlacementType, id: string) => `/admin/display-order/${type}/${id}`;

export function fetchDisplayOrder(type: PlacementType, id: string) {
  return apiFetch<DisplayOrderResponse>(base(type, id));
}

export function searchPlacementProducts(type: PlacementType, id: string, params: { search?: string; page: number }) {
  const qs = new URLSearchParams({ page: String(params.page), limit: '20' });
  if (params.search) qs.set('search', params.search);
  return apiFetch<PlacementProductSearch>(`${base(type, id)}/products?${qs.toString()}`);
}

export function saveDisplayOrder(type: PlacementType, id: string, productIds: string[]) {
  return apiFetch<DisplayOrderResponse>(base(type, id), { method: 'PUT', body: JSON.stringify({ productIds }) });
}

export function resetDisplayOrder(type: PlacementType, id: string) {
  return apiFetch<DisplayOrderResponse>(base(type, id), { method: 'DELETE' });
}
