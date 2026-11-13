import { AppError } from '../utils/AppError.js';
import {
  findProductOverrides,
  captureOverrideSnapshot,
  clearMakingOverride,
  clearStoneOverride,
  restoreOverrideSnapshot,
} from '../repositories/productOverrides.repository.js';
import { findLatestOverrideRemovalLog, insertPricingRuleAuditLog } from '../repositories/pricingRuleAudit.repository.js';
import { enqueueReprice } from '../jobs/pricingRuleJobs.js';

export async function listProductOverrides(filters, pagination) {
  return findProductOverrides(filters, pagination);
}

const CLEAR_ACTIONS = new Set(['REMOVE_MAKING_OVERRIDE', 'REMOVE_STONE_OVERRIDE', 'DISABLE_OVERRIDES']);
const ALL_ACTIONS = new Set([...CLEAR_ACTIONS, 'RESTORE_PREVIOUS_OVERRIDES']);

// The Product Overrides page's bulk actions — every one of them nulls or
// restores specific override fields, never deletes a product_purity_pricing_
// rules row or touches making_charge/gold_value/stone_value/selling_price
// (enforced by only ever calling the narrow repository functions above, which
// don't expose those columns to this layer at all). Each product gets its
// own audit row (product_id set, previous_value = that product's own
// pre-action snapshot) so RESTORE_PREVIOUS_OVERRIDES can look any one of
// them up individually later — a bulk action on 50 products is not one
// undo, it's 50 independently-undoable ones.
export async function applyBulkOverrideAction({ productIds, action, confirmed }, actingAdminId) {
  if (!ALL_ACTIONS.has(action)) throw new AppError(400, `Unknown bulk action: ${action}`);
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new AppError(400, 'Select at least one product.');
  }
  if (!confirmed) {
    throw new AppError(400, 'This bulk action must be explicitly confirmed.');
  }

  let restoredCount = 0;
  let skippedCount = 0;

  for (const productId of productIds) {
    if (action === 'RESTORE_PREVIOUS_OVERRIDES') {
      const log = await findLatestOverrideRemovalLog(productId);
      if (!log || !log.previous_value) {
        skippedCount++;
        continue;
      }
      const beforeRestore = await captureOverrideSnapshot(productId);
      await restoreOverrideSnapshot(productId, log.previous_value);
      restoredCount++;
      await insertPricingRuleAuditLog({
        action: 'OVERRIDE_RESTORED',
        previousValue: beforeRestore,
        newValue: log.previous_value,
        productId,
        adminUserId: actingAdminId,
      });
      continue;
    }

    // CLEAR_ACTIONS: snapshot first (this is what RESTORE_PREVIOUS_OVERRIDES
    // will read back later), then null the relevant field(s).
    const snapshot = await captureOverrideSnapshot(productId);
    if (action === 'REMOVE_MAKING_OVERRIDE' || action === 'DISABLE_OVERRIDES') {
      await clearMakingOverride(productId);
    }
    if (action === 'REMOVE_STONE_OVERRIDE' || action === 'DISABLE_OVERRIDES') {
      await clearStoneOverride(productId);
    }
    await insertPricingRuleAuditLog({
      action: 'BULK_OVERRIDE_ACTION',
      previousValue: snapshot,
      newValue: { action },
      productId,
      adminUserId: actingAdminId,
    });
  }

  // Every touched product needs re-pricing so the cache (and any
  // storefront-visible price) reflects the cleared/restored override
  // immediately, not just on its next unrelated save. rule: null since this
  // isn't triggered by any one pricing_rules row — note this shares the
  // same "rule-less" duplicate-guard slot as a MANUAL single-rule reprice
  // (pricing_reprice_jobs_one_active keys on COALESCE(rule_id, zero-uuid)),
  // so two rule-less actions triggered within the same few seconds could
  // 409 each other. Accepted: the failure mode is "try again shortly", not
  // data loss, and both kinds of job normally finish in well under a second.
  const job = await enqueueReprice({ rule: null, productIds, trigger: 'OVERRIDE_BULK', requestedBy: actingAdminId });

  return {
    repriceJobId: job?.id ?? null,
    restoredCount: action === 'RESTORE_PREVIOUS_OVERRIDES' ? restoredCount : undefined,
    skippedCount: action === 'RESTORE_PREVIOUS_OVERRIDES' ? skippedCount : undefined,
  };
}
