import { useEffect, useMemo, useState } from 'react';
import type { ProductCard as ProductCardData } from '../../api/types';

// Desktop shows 15 (5 columns x 3 rows); mobile shows only the first 8 of
// this same batch via CSS (nth-child, see the matching .module.css files)
// rather than fetching a different count per viewport — that would need
// knowing the viewport at fetch time, which SSR can't, and would cause a
// mismatch between the server-rendered and client-hydrated markup.
const LIMIT = 15;

interface FetchResult {
  products: ProductCardData[];
  total: number;
}

interface UseFixedProductsArgs {
  fetchPage: (_limit: number) => Promise<FetchResult>;
  // Pass an already-known batch (e.g. embedded in the SSR homepage payload)
  // to skip the initial network round-trip when it already has the full
  // LIMIT — otherwise still fetches once in the background to top it up
  // (e.g. a smaller SSR preview batch), same as the caller passing nothing.
  initialProducts?: ProductCardData[];
}

// Shared "fetch a fixed batch, no pagination" behaviour for the two
// homepage sections that show a bounded product grid followed by a View
// All button (Bento Categories grid, Full-Width Collection showcase) —
// kept as one hook so the loading/error/dedup logic can't drift between
// the two call sites.
export function useFixedProducts({ fetchPage, initialProducts }: UseFixedProductsArgs) {
  const hasFullInitial = (initialProducts?.length ?? 0) >= LIMIT;
  const [fetchedProducts, setFetchedProducts] = useState<ProductCardData[]>(initialProducts ?? []);
  const [isLoading, setIsLoading] = useState(!hasFullInitial);
  const [error, setError] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(false);
    try {
      const result = await fetchPage(LIMIT);
      setFetchedProducts(result.products);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasFullInitial) load();
    // Runs once per hook instance (this hook is remounted via `key` on
    // category/collection switch) — `hasFullInitial`/`load` are stable for
    // that instance's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Never a ₹0/misconfigured-price or imageless card on the live homepage —
  // same rule the previous auto-load hook applied.
  const products = useMemo(() => {
    const seen = new Set<string>();
    const list: ProductCardData[] = [];
    for (const p of fetchedProducts) {
      if (!seen.has(p.id) && p.sellingPrice > 0 && p.primaryImageUrl) {
        seen.add(p.id);
        list.push(p);
      }
    }
    return list;
  }, [fetchedProducts]);

  return { products, isLoading, error, retry: load };
}
