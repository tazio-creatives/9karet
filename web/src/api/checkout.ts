import { apiFetch } from './client';
import type { CheckoutPayload, CheckoutResponse } from './types';

export function submitCheckout(payload: CheckoutPayload) {
  return apiFetch<CheckoutResponse>('/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
