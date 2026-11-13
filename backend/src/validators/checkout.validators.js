import { z } from 'zod';

export const checkoutSchema = z.object({
  contact: z.object({
    name: z.string().trim().min(1).max(200),
    mobile: z.string().trim().min(6).max(20),
    email: z.string().trim().email(),
  }),
  addressId: z.string().uuid(),
  couponCode: z.string().trim().min(1).max(50).optional(),
  deliveryNote: z.string().trim().max(500).optional(),
  // Items are explicit, not read server-side from the persisted cart — this
  // is what lets "Buy Now" (plan §11: "creates a single-item cart") reuse
  // the exact same endpoint without ever touching the shopper's real cart.
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        quantity: z.coerce.number().int().positive().max(20),
        // Free-text engraving/customization request for this line, printed
        // on the internal work order (Phase 2) — never affects pricing.
        customizationNote: z.string().trim().max(500).optional(),
      }),
    )
    .min(1),
});
