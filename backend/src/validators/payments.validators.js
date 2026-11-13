import { z } from 'zod';

export const simulatePaymentSchema = z.object({
  providerRef: z.string().trim().min(1),
  outcome: z.enum(['SUCCEEDED', 'FAILED']),
});
