import { apiFetch } from './client';
import type { StoneType, StoneTypeInput } from './types';

export function fetchStoneTypes(opts: { activeOnly?: boolean } = {}) {
  const qs = opts.activeOnly ? '?activeOnly=true' : '';
  return apiFetch<{ stoneTypes: StoneType[] }>(`/admin/stone-types${qs}`);
}

export function createStoneType(input: StoneTypeInput) {
  return apiFetch<{ stoneType: StoneType }>('/admin/stone-types', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateStoneType(id: string, input: Partial<StoneTypeInput>) {
  return apiFetch<{ stoneType: StoneType }>(`/admin/stone-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
