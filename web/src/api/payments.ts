import { apiFetch } from './client';
import type { Order } from './types';

// Dev-only stand-in for the gateway's own payment page (plan §11 stub
// scope) — see backend paymentService.simulatePayment for what this
// actually exercises server-side.
export function simulatePayment(providerRef: string, outcome: 'SUCCEEDED' | 'FAILED') {
  return apiFetch<{ order: Order }>('/payments/simulate', {
    method: 'POST',
    body: JSON.stringify({ providerRef, outcome }),
  });
}
