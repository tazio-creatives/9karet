import { z } from 'zod';

export const createAddressSchema = z.object({
  type: z.enum(['HOME', 'OFFICE', 'OTHER']).optional(),
  isDefault: z.boolean().optional(),
  name: z.string().trim().min(1).max(200),
  mobileNumber: z.string().trim().min(6).max(20),
  addressLine: z.string().trim().min(1).max(500),
  building: z.string().trim().max(200).nullable().optional(),
  landmark: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  // India Post PIN: 6 digits, never starting with 0. Non-digits are dropped
  // first, so a pasted "400 001" or a stray "673019`" still saves cleanly.
  pincode: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().regex(/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit pincode')),
  country: z.string().trim().min(1).max(100).optional(),
});

export const updateAddressSchema = createAddressSchema.partial();
