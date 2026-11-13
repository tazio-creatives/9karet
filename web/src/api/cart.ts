import { apiFetch } from './client';
import type { Cart } from './types';

export function fetchCart() {
  return apiFetch<Cart>('/cart');
}

export function addCartItem(productId: string, quantity = 1, variantId?: string | null) {
  return apiFetch<Cart>('/cart/items', {
    method: 'POST',
    body: JSON.stringify({
      productId,
      quantity,
      ...(variantId ? { variantId } : {}),
    }),
  });
}

export function updateCartItem(variantId: string, quantity: number) {
  return apiFetch<Cart>(`/cart/items/${variantId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(variantId: string) {
  return apiFetch<Cart>(`/cart/items/${variantId}`, { method: 'DELETE' });
}
