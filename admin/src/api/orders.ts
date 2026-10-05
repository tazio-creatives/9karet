import { apiFetch } from './client';
import type {
  OrderDetail,
  OrderListItem,
  OrderStatus,
  StatusFilterValue,
  WorkOrderResponse,
  InvoiceResponse,
  ReturnRequest,
  ReversePickup,
} from './types';

export interface OrderListResponse {
  orders: OrderListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function fetchAdminOrders(status?: StatusFilterValue, page = 1, limit = 20, search?: string) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) qs.set('status', status);
  if (search) qs.set('search', search);
  return apiFetch<OrderListResponse>(`/admin/orders?${qs.toString()}`);
}

export interface OrderSummary {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  toFulfilCount: number;
  ordersToday: number;
}

export function fetchAdminOrderSummary(status?: StatusFilterValue) {
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<OrderSummary>(`/admin/orders/summary${suffix}`);
}

export function fetchAdminOrder(id: string) {
  return apiFetch<{ order: OrderDetail }>(`/admin/orders/${id}`);
}

// Confirmed -> Processing (dedicated action, spec §3) — separate from the
// generic override below, no body needed.
export function startProcessing(id: string) {
  return apiFetch<{ order: OrderDetail }>(`/admin/orders/${id}/start-processing`, {
    method: 'POST',
  });
}

// Processing -> Ready to Ship — a pure status change, no courier call. The
// actual shipment/AWB booking is a separate later step (api/shipping.ts's
// createShipment), triggered once the order sits here with no shipment yet.
export function markReadyToShip(id: string) {
  return apiFetch<{ order: OrderDetail }>(`/admin/orders/${id}/mark-ready-to-ship`, {
    method: 'POST',
  });
}

// Manual override for the exception states only — see
// utils/orderStatus.ts#ADMIN_MANUAL_TARGETS for exactly which OrderStatus
// values the server will accept here.
export function updateOrderStatus(id: string, status: OrderStatus, note?: string) {
  return apiFetch<{ order: OrderDetail }>(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  });
}

// Records a refund already issued manually from the Cashfree dashboard —
// only valid for a cancelled/returned order whose payment is still PAID.
// Returned order: put its items back in stock after quality check.
export function restockOrder(id: string) {
  return apiFetch<{ order: OrderDetail }>(`/admin/orders/${id}/restock`, { method: 'POST' });
}

export function markOrderRefunded(id: string, reference?: string) {
  return apiFetch<{ order: OrderDetail }>(`/admin/orders/${id}/mark-refunded`, {
    method: 'POST',
    body: JSON.stringify({ reference }),
  });
}

// Phase 2 — work order (job card). Gated server-side on the order having
// reached Processing at least once (order.canPrintWorkOrder on the detail
// response mirrors this for button enablement, without a second round trip).
export function fetchWorkOrder(id: string) {
  return apiFetch<WorkOrderResponse>(`/admin/orders/${id}/work-order`);
}

export function recordWorkOrderPrint(id: string) {
  return apiFetch<{ printNumber: number; isReprint: boolean; printedAt: string }>(
    `/admin/orders/${id}/work-order/print`,
    { method: 'POST' },
  );
}

// Tax invoice — gated server-side on payment_status === 'PAID' (order.canPrintInvoice
// on the detail response mirrors this for button enablement). The invoice number is
// assigned on first fetch, not at payment time (see invoices.repository.js).
export function fetchInvoice(id: string) {
  return apiFetch<InvoiceResponse>(`/admin/orders/${id}/invoice`);
}

export function recordInvoicePrint(id: string) {
  return apiFetch<{ printNumber: number; isReprint: boolean; printedAt: string }>(
    `/admin/orders/${id}/invoice/print`,
    { method: 'POST' },
  );
}

// Return requests — the review trail is independent of order_status
// (order.returnRequest on the detail response already carries this; these
// are only needed for the approve/reject action itself).
export function updateReturnRequestStatus(id: string, status: 'APPROVED' | 'REJECTED') {
  return apiFetch<{ returnRequest: ReturnRequest }>(`/admin/orders/${id}/return-request`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Only reachable once the return request is APPROVED — the backend enforces
// this too (see shippingService.js#createReversePickupForReturnRequest); the
// admin UI just doesn't offer the button outside that state.
export function createReversePickup(orderId: string) {
  return apiFetch<{ reversePickup: ReversePickup }>(`/admin/orders/${orderId}/return-request/reverse-pickup`, {
    method: 'POST',
  });
}

export function syncReversePickup(orderId: string) {
  return apiFetch<{ reversePickup: ReversePickup }>(`/admin/orders/${orderId}/return-request/reverse-pickup/sync`, {
    method: 'POST',
  });
}

// Dev-only — walks a stub-provider reverse pickup through its lifecycle
// without a real courier, mirroring simulateTracking for forward shipments.
export function simulateReversePickup(orderId: string, status: ReversePickup['status']) {
  return apiFetch<{ reversePickup: ReversePickup }>(
    `/admin/orders/${orderId}/return-request/reverse-pickup/simulate`,
    { method: 'POST', body: JSON.stringify({ status }) },
  );
}
