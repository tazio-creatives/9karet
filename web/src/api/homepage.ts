import { apiFetch } from './client';
import type { HomepageSection } from './types';

export function fetchHomepage() {
  return apiFetch<{ sections: HomepageSection[] }>('/homepage');
}
