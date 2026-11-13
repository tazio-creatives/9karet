import { apiFetch } from './client';

export interface ContactMessageInput {
  name: string;
  email: string;
  phone?: string;
  orderNumber?: string;
  message: string;
  // Honeypot — always sent empty by real visitors (see ContactPage).
  website?: string;
}

export function sendContactMessage(input: ContactMessageInput) {
  return apiFetch<{ ok: true }>('/contact', { method: 'POST', body: JSON.stringify(input) });
}
