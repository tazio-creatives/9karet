import { apiFetch } from './client';
import type { Address, AddressInput } from './types';

export function fetchAddresses() {
  return apiFetch<{ addresses: Address[] }>('/addresses');
}

export function createAddress(input: AddressInput) {
  return apiFetch<{ address: Address }>('/addresses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAddress(id: string, input: Partial<AddressInput>) {
  return apiFetch<{ address: Address }>(`/addresses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteAddress(id: string) {
  return apiFetch<void>(`/addresses/${id}`, { method: 'DELETE' });
}
