import { z } from 'zod';

// Admin-entered at Create Shipment time — no product-catalog weight/
// dimension fields exist, so the courier needs these confirmed per shipment
// instead.
export const createShipmentSchema = z.object({
  weightGrams: z.coerce.number().positive().max(50000),
  lengthCm: z.coerce.number().positive().max(200),
  widthCm: z.coerce.number().positive().max(200),
  heightCm: z.coerce.number().positive().max(200),
  // Courier chosen in the dialog (shippingProviders key); omitted = default.
  provider: z.string().trim().min(1).max(40).optional(),
});

export const simulateTrackingSchema = z.object({
  status: z.enum(['OUT_FOR_DELIVERY', 'DELIVERED']),
});

export const simulateReversePickupSchema = z.object({
  status: z.enum([
    'REVERSE_PICKUP_SCHEDULED',
    'REVERSE_PICKED_UP',
    'REVERSE_IN_TRANSIT',
    'REVERSE_RECEIVED',
    'REVERSE_PICKUP_FAILED',
    'REVERSE_PICKUP_CANCELLED',
  ]),
});

export const addTrackingEventSchema = z.object({
  status: z.string().trim().min(1).max(80),
  location: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});
