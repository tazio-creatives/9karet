import type { OrderStatus, StatusFilterValue } from '../api/types';

// Every real order_status value (backend/src/utils/orderStatus.js#ORDER_STATUSES).
export const ORDER_STATUSES: OrderStatus[] = [
  'CONFIRMED',
  'PROCESSING',
  'READY_TO_SHIP',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELAYED',
  'DELIVERY_FAILED',
  'RETURN_INITIATED',
  'RETURNED',
  'CANCELLED',
];

// What the Orders list filter dropdown offers — spans payment_status and
// order_status (mirrors backend's STATUS_FILTER_VALUES).
export const STATUS_FILTER_VALUES: StatusFilterValue[] = ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'REFUND_PENDING', ...ORDER_STATUSES];

// What the "Change Order Status" manual-override dropdown offers — mirrors
// backend's ADMIN_MANUAL_TARGETS exactly, so the UI never offers a choice
// the server will reject. Courier-controlled statuses (Ready to Ship,
// Shipped, In Transit, Out for Delivery, Delivered) aren't reachable here —
// Ready to Ship needs its own validated flow (Phase 3), the rest are meant
// to be tracking-driven, not a free-form admin dropdown.
export const ADMIN_MANUAL_TARGETS: OrderStatus[] = [
  'PROCESSING',
  'CANCELLED',
  'DELAYED',
  'DELIVERY_FAILED',
  'RETURN_INITIATED',
  'RETURNED',
];

// DELIVERED is the only true "success" (final, positive) state — green.
// CONFIRMED/PROCESSING/READY_TO_SHIP/SHIPPED/IN_TRANSIT/OUT_FOR_DELIVERY are
// still in progress, so they read as "info" (light blue) instead of reusing
// that green. DELAYED/DELIVERY_FAILED/RETURN_INITIATED/CANCELLED are
// warning/danger exception states; RETURNED is a settled, neutral outcome.
export const ORDER_STATUS_BADGE_CLASS: Record<string, string> = {
  DELIVERED: 'badgeSuccess',
  CONFIRMED: 'badgeInfo',
  PROCESSING: 'badgeInfo',
  READY_TO_SHIP: 'badgeInfo',
  SHIPPED: 'badgeInfo',
  IN_TRANSIT: 'badgeInfo',
  OUT_FOR_DELIVERY: 'badgeInfo',
  DELAYED: 'badgeWarning',
  DELIVERY_FAILED: 'badgeDanger',
  RETURN_INITIATED: 'badgeWarning',
  RETURNED: 'badgeNeutral',
  CANCELLED: 'badgeDanger',
  PENDING_PAYMENT: 'badgeWarning',
  PAYMENT_FAILED: 'badgeDanger',
};

export const PAYMENT_STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: 'badgeWarning',
  PAID: 'badgeSuccess',
  FAILED: 'badgeDanger',
  REFUNDED: 'badgeNeutral',
};

export const SHIPMENT_STATUS_BADGE_CLASS: Record<string, string> = {
  NOT_CREATED: 'badgeNeutral',
  SHIPMENT_CREATED: 'badgeInfo',
  PICKED_UP: 'badgeInfo',
  IN_TRANSIT: 'badgeInfo',
  REACHED_DESTINATION: 'badgeInfo',
  OUT_FOR_DELIVERY: 'badgeInfo',
  DELIVERED: 'badgeSuccess',
  DELAYED: 'badgeWarning',
  DELIVERY_FAILED: 'badgeDanger',
  RTO_INITIATED: 'badgeWarning',
  RETURNED: 'badgeNeutral',
  CANCELLED: 'badgeDanger',
};

// order_status is null until payment succeeds — "Awaiting Payment" covers
// that case for anywhere this renders a status label (list table, header
// badge) rather than leaving a blank space.
export function formatOrderStatus(status: string | null) {
  if (!status) return 'Awaiting Payment';
  // The orders list's PENDING_PAYMENT pseudo-status (see OrdersListPage's
  // displayStatus()) otherwise formats to "Pending Payment", inconsistent
  // with the "Pending" tab label right above it.
  if (status === 'PENDING_PAYMENT') return 'Pending';
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
