import { z } from 'zod';

export const listProductOverridesQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  purityValueId: z.string().uuid().optional(),
  hasMakingOverride: z.coerce.boolean().optional(),
  hasStoneOverride: z.coerce.boolean().optional(),
  appliedRuleId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const bulkOverrideActionSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1, 'Select at least one product.'),
  action: z.enum(['REMOVE_MAKING_OVERRIDE', 'REMOVE_STONE_OVERRIDE', 'DISABLE_OVERRIDES', 'RESTORE_PREVIOUS_OVERRIDES']),
  // Required true, not just truthy — the UI must show a real confirmation
  // dialog first (ConfirmDialog, matching every other destructive bulk
  // action in the admin), not just default this to true silently.
  confirmed: z.literal(true, { errorMap: () => ({ message: 'This action must be explicitly confirmed.' }) }),
});
