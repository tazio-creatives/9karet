import { z } from 'zod';

// Signup asks for the minimum useful information only (plan §15) — full
// name and email, nothing else, and both optional here since either field
// may already be set from a prior call.
export const updateCustomerProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
});
