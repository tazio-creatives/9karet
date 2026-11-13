import { apiFetch } from './client';
import type { DeliveryEstimate, Order, PaymentStatus, OrderStatus, StatusFilterValue, ReturnReason, ReturnRequest } from './types';

export interface OrderSummary {
  id: string;
  orderNumber: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus | null;
  totalAmount: number;
  createdAt: string;
  itemCount: number;
  previewProductName: string | null;
  previewImageUrl: string | null;
  confirmedAt: string | null;
  processingAt: string | null;
  readyToShipAt: string | null;
  shippedAt: string | null;
  inTransitAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  deliveryEstimate: DeliveryEstimate | null;
}

export interface OrderListResponse {
  orders: OrderSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OrderStats {
  totalOrders: number;
  activeOrders: number;
  totalSpent: number;
}

export function fetchOrders(page = 1, limit = 10, status?: StatusFilterValue) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) qs.set('status', status);
  return apiFetch<OrderListResponse>(`/orders?${qs.toString()}`);
}

export function fetchOrderStats() {
  return apiFetch<OrderStats>('/orders/stats');
}

export function fetchOrderById(id: string) {
  return apiFetch<{ order: Order }>(`/orders/${id}`);
}

export type CancelReason = 'ORDERED_BY_MISTAKE' | 'BETTER_PRICE' | 'DELIVERY_TOO_SLOW' | 'CHANGED_MIND' | 'OTHER';

export function cancelOrder(orderId: string, input: { reason: CancelReason; note?: string }) {
  return apiFetch<{ orderId: string; orderStatus: OrderStatus; refundDays: number }>(`/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchReturnRequest(orderId: string) {
  return apiFetch<{ returnRequest: ReturnRequest | null }>(`/orders/${orderId}/return-request`);
}

// multipart/form-data so client.ts skips the JSON Content-Type header and
// lets fetch set its own multipart boundary. The server requires the video
// and 3–8 photos.
export function createReturnRequest(
  orderId: string,
  input: { reason: ReturnReason; note?: string; video?: File; photos?: File[] },
) {
  const body = new FormData();
  body.set('reason', input.reason);
  if (input.note) body.set('note', input.note);
  if (input.video) body.set('video', input.video);
  for (const photo of input.photos ?? []) body.append('photos', photo);
  return apiFetch<{ returnRequest: ReturnRequest }>(`/orders/${orderId}/return-request`, {
    method: 'POST',
    body,
  });
}

export function cancelReturnRequest(orderId: string) {
  return apiFetch<{ returnRequest: ReturnRequest }>(`/orders/${orderId}/return-request/cancel`, {
    method: 'POST',
  });
}
