import { apiFetch } from './client';

export type ContactMessageStatus = 'NEW' | 'READ' | 'RESOLVED';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  orderNumber: string | null;
  message: string;
  status: ContactMessageStatus;
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactMessageListResponse {
  messages: ContactMessage[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  newCount: number;
}

export function fetchContactMessages(params: { status?: ContactMessageStatus; search?: string; page?: number }) {
  const qs = new URLSearchParams({ page: String(params.page ?? 1), limit: '20' });
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  return apiFetch<ContactMessageListResponse>(`/admin/contact-messages?${qs.toString()}`);
}

export function updateContactMessage(id: string, fields: { status?: ContactMessageStatus; adminNote?: string | null }) {
  return apiFetch<{ message: ContactMessage }>(`/admin/contact-messages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}
