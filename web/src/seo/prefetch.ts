import { matchPath } from 'react-router-dom';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { fetchHomepage } from '../api/homepage';
import { fetchCategories } from '../api/categories';
import { fetchCollectionBySlug } from '../api/collections';
import { fetchProductBySlug } from '../api/products';
import { parsePlpFilters } from '../features/plp/parsePlpFilters';
import {
  productsQueryKey,
  fetchProductsPage,
  getNextProductsPageParam,
  type ProductsQueryFilters,
} from '../features/plp/productsQuery';
import type { Category } from '../api/types';
import { fetchBlogPosts, fetchBlogPost, blogListQueryKey, blogPostQueryKey } from '../api/blog';

// Prefetches the exact same TanStack Query key + data each of the 4 SSR
// page components fetches client-side (plan §1a) — the query key has to
// match exactly (see parsePlpFilters) for dehydrate/hydrate to actually
// avoid a client refetch, not just look similar.
export async function prefetchForRoute(
  queryClient: QueryClient,
  url: string,
): Promise<{ notFound: boolean }> {
  const { pathname, searchParams } = new URL(url, 'http://internal');

  // The header's mega menu needs the category tree on every route, not just
  // PLP/PDP (which already prefetched it for their own breadcrumbs/grid) —
  // safePrefetch is a no-op if a route below prefetches the same key again.
  await safePrefetch(queryClient, ['categories'], fetchCategories);

  if (pathname === '/') {
    await safePrefetch(queryClient, ['homepage'], fetchHomepage);
    return { notFound: false };
  }

  if (pathname === '/blog') {
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    await safePrefetch(queryClient, [...blogListQueryKey(page)], () => fetchBlogPosts(page));
    return { notFound: false };
  }

  const blogPostMatch = matchPath('/blog/:slug', pathname);
  if (blogPostMatch) {
    const slug = blogPostMatch.params.slug as string;
    const notFound = await fetchPrimary(queryClient, [...blogPostQueryKey(slug)], () => fetchBlogPost(slug));
    return { notFound };
  }

  const collectionMatch = matchPath('/collections/:collectionSlug', pathname);
  if (collectionMatch) {
    const collectionSlug = collectionMatch.params.collectionSlug as string;
    const notFound = await fetchPrimary(queryClient, ['collection', collectionSlug], () =>
      fetchCollectionBySlug(collectionSlug),
    );
    if (!notFound) {
      const filters = { collection: collectionSlug, ...parsePlpFilters(searchParams) };
      await safePrefetchProducts(queryClient, filters);
    }
    return { notFound };
  }

  if (pathname === '/new-arrivals' || pathname === '/jewellery') {
    const filters = parsePlpFilters(searchParams);
    await safePrefetchProducts(queryClient, filters);
    return { notFound: false };
  }

  const pdpMatch = matchPath('/:categorySlug/:productSlug', pathname);
  if (pdpMatch) {
    const productSlug = pdpMatch.params.productSlug as string;
    const notFound = await fetchPrimary(queryClient, ['product', productSlug], () =>
      fetchProductBySlug(productSlug),
    );
    await safePrefetch(queryClient, ['categories'], fetchCategories);
    return { notFound };
  }

  const plpMatch = matchPath('/:categorySlug', pathname);
  if (plpMatch) {
    const categorySlug = plpMatch.params.categorySlug as string;
    await safePrefetch(queryClient, ['categories'], fetchCategories);
    const categoriesData = queryClient.getQueryData<{ categories: Category[] }>(['categories']);
    const exists = categoriesData?.categories.some((c) => c.slug === categorySlug) ?? false;
    if (!exists) return { notFound: true };

    const filters = { category: categorySlug, ...parsePlpFilters(searchParams) };
    await safePrefetchProducts(queryClient, filters);
    return { notFound: false };
  }

  return { notFound: false };
}

// Primary resource for the page (product/collection) — a 404 here means the
// whole route is not-found, so it's reported back to the render host to set
// the real HTTP status. Non-404 errors bubble up so the caller falls back
// to the minimal shell rather than serving a half-rendered page.
async function fetchPrimary<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
): Promise<boolean> {
  try {
    await queryClient.fetchQuery({ queryKey, queryFn });
    return false;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return true;
    throw err;
  }
}

// Secondary/supporting data (categories for breadcrumbs, the product grid
// on a PLP) — best-effort. If it fails the page still renders, just without
// that piece pre-hydrated, and the client fetches it normally.
async function safePrefetch<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
): Promise<void> {
  try {
    await queryClient.prefetchQuery({ queryKey, queryFn });
  } catch {
    // intentionally swallowed
  }
}

// The PLP grid is an infinite-scroll query client-side (productsQuery.ts) —
// this has to prefetch the same shape (prefetchInfiniteQuery, not
// prefetchQuery) with the same key/queryFn/getNextPageParam, or the
// dehydrated first page comes back as the wrong cache shape and the client
// silently refetches from scratch on hydration instead of reusing it. Only
// page 1 is fetched server-side (the `pages: 1` default) — scrolling further
// is a client-only concern.
async function safePrefetchProducts(queryClient: QueryClient, filters: ProductsQueryFilters): Promise<void> {
  try {
    await queryClient.prefetchInfiniteQuery({
      queryKey: productsQueryKey(filters),
      queryFn: ({ pageParam }) => fetchProductsPage(filters, pageParam as number),
      initialPageParam: 1,
      getNextPageParam: getNextProductsPageParam,
    });
  } catch {
    // intentionally swallowed
  }
}
