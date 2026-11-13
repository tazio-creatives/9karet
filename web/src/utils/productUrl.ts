import type { ProductCard } from '../api/types';

// Canonical PDP URL (plan §40: never /product?id=123). Falls back to the
// bare slug if a product somehow has no category yet.
export function productUrl(product: Pick<ProductCard, 'slug' | 'categorySlug'>): string {
  return product.categorySlug ? `/${product.categorySlug}/${product.slug}` : `/${product.slug}`;
}
