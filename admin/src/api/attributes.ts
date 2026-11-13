import { apiFetch } from './client';

export interface AttributeValue {
  id: string;
  value: string;
  label: string;
  refId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Attribute {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  values: AttributeValue[];
}

export function fetchAttributes() {
  return apiFetch<{ attributes: Attribute[] }>('/admin/attributes');
}

export function createAttribute(input: { code: string; name: string; sortOrder?: number }) {
  return apiFetch<{ id: string }>('/admin/attributes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAttribute(id: string, input: { name?: string; sortOrder?: number; isActive?: boolean }) {
  return apiFetch<void>(`/admin/attributes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function createAttributeValue(attributeId: string, input: { value: string; label: string; sortOrder?: number }) {
  return apiFetch<{ id: string }>(`/admin/attributes/${attributeId}/values`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAttributeValue(valueId: string, input: { label?: string; sortOrder?: number; isActive?: boolean }) {
  return apiFetch<void>(`/admin/attributes/values/${valueId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
