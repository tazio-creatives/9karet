import { apiFetch } from './client';
import type { SearchResults } from './types';

export function search(q: string) {
  return apiFetch<SearchResults>(`/search?q=${encodeURIComponent(q)}`);
}
