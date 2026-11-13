import { apiFetch } from './client';
import type { Admin } from './types';

export function login(email: string, password: string) {
  return apiFetch<{ admin: Admin }>('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return apiFetch<void>('/auth/admin/logout', { method: 'POST' });
}

export function fetchMe() {
  return apiFetch<{ admin: Admin }>('/auth/admin/me');
}
