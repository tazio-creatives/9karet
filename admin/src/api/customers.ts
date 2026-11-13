import { apiFetch } from './client';
import type { Customer, OrderListItem } from './types';

export interface CustomerListResponse {
  customers: Customer[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function fetchAdminCustomers(search?: string, page = 1, limit = 20) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) qs.set('search', search);
  return apiFetch<CustomerListResponse>(`/admin/customers?${qs.toString()}`);
}

export function fetchAdminCustomer(id: string) {
  return apiFetch<{ customer: Customer; orders: OrderListItem[] }>(`/admin/customers/${id}`);
}
