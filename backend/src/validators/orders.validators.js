import { z } from 'zod';
import {
  ADMIN_MANUAL_TARGETS,
  STATUS_FILTER_VALUES,
  RETURN_REASONS,
  RETURN_REQUEST_STATUSES,
  CUSTOMER_CANCEL_REASONS,
} from '../utils/orderStatus.js';

export const listOrdersQuerySchema = z.object({
  status: z.enum(STATUS_FILTER_VALUES).optional(),
  // Matches order number (what the work order's barcode encodes — a
  // scanner "typing" a scanned code into this field searches the same way
  // as pasting the order number in by hand) or contact mobile.
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export const orderSummaryQuerySchema = z.object({
  status: z.enum(STATUS_FILTER_VALUES).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(ADMIN_MANUAL_TARGETS),
  note: z.string().trim().max(500).optional(),
});

// multipart/form-data body (video is a separate file field, handled by
// multer) — everything here comes through as strings.
export const cancelOrderSchema = z.object({
  reason: z.enum(CUSTOMER_CANCEL_REASONS),
  note: z.string().trim().max(500).optional(),
});

// Optional Cashfree refund id/UTR, recorded in the order history.
export const markRefundedSchema = z.object({
  reference: z.string().trim().max(100).optional(),
});

export const createReturnRequestSchema = z.object({
  reason: z.enum(RETURN_REASONS),
  note: z.string().trim().max(1000).optional(),
});

export const updateReturnRequestStatusSchema = z.object({
  // COMPLETED isn't admin-settable directly — it's only ever set alongside
  // an order_status change to RETURNED (see adminOrders.controller.js).
  status: z.enum(RETURN_REQUEST_STATUSES.filter((s) => s !== 'COMPLETED')),
});
