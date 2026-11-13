import type { GoldColor, MetalType, Purity, SortOption } from '../../api/types';

export interface ParsedPlpFilters {
  metal?: MetalType;
  purity?: Purity;
  goldColor?: GoldColor;
  priceMin?: number;
  priceMax?: number;
  sort: SortOption;
}

// Single source of truth for URL <-> filter-state parsing, shared by the
// client hook (usePlpFilters) and the SSR prefetch router (seo/prefetch.ts)
// — both must build the exact same TanStack Query key from the same URL for
// server-dehydrated state to actually be reused on hydration instead of
// silently refetched.
export function parsePlpFilters(searchParams: URLSearchParams): ParsedPlpFilters {
  const metal = (searchParams.get('metal') as MetalType | null) ?? undefined;
  const purity = (searchParams.get('purity') as Purity | null) ?? undefined;
  const goldColor = (searchParams.get('goldColor') as GoldColor | null) ?? undefined;
  const priceMinRaw = searchParams.get('priceMin');
  const priceMaxRaw = searchParams.get('priceMax');
  const priceMin = priceMinRaw ? Number(priceMinRaw) : undefined;
  const priceMax = priceMaxRaw ? Number(priceMaxRaw) : undefined;
  const sort = (searchParams.get('sort') as SortOption | null) ?? 'featured';

  return { metal, purity, goldColor, priceMin, priceMax, sort };
}
