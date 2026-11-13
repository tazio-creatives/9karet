import { apiFetch } from './client';
import type { Wishlist } from './types';

export function fetchWishlist() {
  return apiFetch<Wishlist>('/wishlist');
}

export function addWishlistItem(productId: string) {
  return apiFetch<Wishlist>('/wishlist/items', {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });
}

export function removeWishlistItem(productId: string) {
  return apiFetch<Wishlist>(`/wishlist/items/${productId}`, { method: 'DELETE' });
}
