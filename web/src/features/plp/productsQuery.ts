import { fetchProducts, type ListProductsParams } from '../../api/products';
import type { ProductListResponse } from '../../api/types';

// Single source of truth for the PLP's infinite-scroll product query — the
// query key, queryFn, and getNextPageParam here have to be byte-identical
// between the client's useInfiniteQuery (ProductListing.tsx) and the SSR
// prefetch (seo/prefetch.ts), or the server-dehydrated first page silently
// gets refetched on hydration instead of reused (same reasoning as
// parsePlpFilters.ts's own single-source-of-truth comment).
export type ProductsQueryFilters = Omit<ListProductsParams, 'page' | 'limit'>;

export function productsQueryKey(filters: ProductsQueryFilters) {
  return ['products', filters] as const;
}

export function fetchProductsPage(filters: ProductsQueryFilters, pageParam: number) {
  return fetchProducts({ ...filters, page: pageParam, limit: 24 });
}

export function getNextProductsPageParam(lastPage: ProductListResponse): number | undefined {
  return lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined;
}
