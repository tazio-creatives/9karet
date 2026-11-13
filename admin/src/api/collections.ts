import { apiFetch } from './client';
import type { Collection } from './types';

export function fetchAdminCollections() {
  return apiFetch<{ collections: Collection[] }>('/admin/collections');
}

export function createCollection(input: Partial<Collection>) {
  return apiFetch<{ collection: Collection }>('/admin/collections', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCollection(id: string, input: Partial<Collection>) {
  return apiFetch<{ collection: Collection }>(`/admin/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteCollection(id: string) {
  return apiFetch<void>(`/admin/collections/${id}`, { method: 'DELETE' });
}
