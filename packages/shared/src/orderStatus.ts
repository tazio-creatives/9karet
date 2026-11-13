// Order state machine — see plan §11. Defined once here so backend, web,
// and admin never drift on the set of valid statuses.
export const ORDER_STATUS = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'PAYMENT_FAILED',
  'EXPIRED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'REFUNDED',
] as const;

export type OrderStatus = (typeof ORDER_STATUS)[number];
