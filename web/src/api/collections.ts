import { apiFetch } from './client';
import type { Collection } from './types';

export function fetchCollections() {
  return apiFetch<{ collections: Collection[] }>('/collections');
}

export function fetchCollectionBySlug(slug: string) {
  return apiFetch<{ collection: Collection }>(`/collections/${slug}`);
}
