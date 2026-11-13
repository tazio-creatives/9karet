import { apiFetch } from './client';
import type { Customer } from './types';

export function fetchMe() {
  return apiFetch<{ customer: Customer }>('/customers/me');
}

export function logout() {
  return apiFetch<void>('/customers/logout', { method: 'POST' });
}

// Both fields are optional server-side (schema allows leaving either
// unchanged) — an empty string would fail the backend's z.string().email()
// check, so omit rather than send blank.
export function updateMe(input: { fullName?: string; email?: string }) {
  return apiFetch<{ customer: Customer }>('/customers/me', {
    method: 'PATCH',
    body: JSON.stringify({
      ...(input.fullName?.trim() ? { fullName: input.fullName.trim() } : {}),
      ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    }),
  });
}
