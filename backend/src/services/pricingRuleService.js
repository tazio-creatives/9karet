import { withTransaction } from '../config/db.js';
import { NotFoundError, AppError } from '../utils/AppError.js';
import {
  findRuleById,
  insertRule,
  updateRule,
  deleteRule,
  findProductIdsInRuleScope,
  replaceRuleCategories,
  replaceRuleProducts,
  replaceRuleStoneTypes,
  replaceRulePurities,
  replaceRuleConditions,
} from '../repositories/pricingRules.repository.js';
import { insertPricingRuleAuditLog } from '../repositories/pricingRuleAudit.repository.js';
import { invalidateRuleSetCache } from './pricingRuleResolver.js';
import { enqueueReprice } from '../jobs/pricingRuleJobs.js';

const LIVE_STATUSES = new Set(['ACTIVE', 'SCHEDULED']);
function isLiveStatus(status) {
  return LIVE_STATUSES.has(status);
}

const SCALAR_FIELDS = [
  'ruleType',
  'name',
  'scope',
  'discountType',
  'discountValue',
  'purityScope',
  'overrideMode',
  'startsAt',
  'endsAt',
  'status',
  'priority',
  'notes',
];

// Applies whichever scope/condition join tables are relevant to this rule's
// type/scope — a MAKING_CHARGE rule never gets stone-type/condition rows,
// a GLOBAL rule never gets category/product rows, etc. Only replaces a join
// table when the caller actually passed that key, so a partial update (e.g.
// PATCH-ing just `name`) never wipes categoryIds/productIds it didn't touch.
async function replaceScopeAndConditions(ruleId, rule, input) {
  if (rule.scope === 'CATEGORY' && Object.hasOwn(input, 'categoryIds')) {
    await replaceRuleCategories(ruleId, input.categoryIds ?? []);
  }
  if (rule.scope === 'PRODUCT' && Object.hasOwn(input, 'productIds')) {
    await replaceRuleProducts(ruleId, input.productIds ?? []);
  }
  if (rule.rule_type === 'STONE' && Object.hasOwn(input, 'stoneTypeIds')) {
    await replaceRuleStoneTypes(ruleId, input.stoneTypeIds ?? []);
  }
  if (Object.hasOwn(input, 'purityValueIds')) {
    await replaceRulePurities(ruleId, input.purityValueIds ?? []);
  }
  if (rule.rule_type === 'STONE' && Object.hasOwn(input, 'conditions')) {
    await replaceRuleConditions(ruleId, input.conditions ?? []);
  }
}

// input is already-validated, camelCase (Phase 3's validators.js sits in
// front of this once the controller exists — Phase 2 callers pass a plain
// object directly, same as Phase 1's resolver being callable standalone
// before any HTTP layer existed).
export async function createPricingRule(input, actingAdminId) {
  const rule = await withTransaction(async () => {
    const created = await insertRule({
      ruleType: input.ruleType,
      name: input.name,
      scope: input.scope,
      discountType: input.discountType,
      discountValue: input.discountValue,
      purityScope: input.purityScope ?? 'ALL',
      overrideMode: input.overrideMode ?? 'PRESERVE',
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      status: input.status ?? 'DRAFT',
      priority: input.priority ?? 0,
      notes: input.notes ?? null,
      createdBy: actingAdminId,
      updatedBy: actingAdminId,
    });
    await replaceScopeAndConditions(created.id, created, input);
    return created;
  });

  invalidateRuleSetCache();
  await insertPricingRuleAuditLog({
    ruleId: rule.id,
    ruleNameSnapshot: rule.name,
    ruleType: rule.rule_type,
    action: 'CREATED',
    newValue: rule,
    adminUserId: actingAdminId,
  });

  // A DRAFT rule affects nothing yet — no reprice needed. A SCHEDULED rule
  // whose window hasn't started also affects nothing yet; the status-sweep
  // job enqueues its own reprice (trigger RULE_ACTIVATED) once it actually
  // goes live. Only a rule created directly as ACTIVE reprices immediately.
  if (rule.status === 'ACTIVE') {
    const productIds = await findProductIdsInRuleScope(rule);
    await enqueueReprice({ rule, productIds, trigger: 'RULE_CREATED', requestedBy: actingAdminId });
  }

  return rule;
}

export async function updatePricingRule(ruleId, input, actingAdminId) {
  const existing = await findRuleById(ruleId);
  if (!existing) throw new NotFoundError('Pricing rule not found');

  // Resolved BEFORE the write, per the plan: a product dropped from scope by
  // this edit (e.g. removed from the category list) must still get one more
  // reprice pass so its stale discount is cleared, not left stuck forever.
  const oldProductIds = isLiveStatus(existing.status) ? await findProductIdsInRuleScope(existing) : [];

  const updated = await withTransaction(async () => {
    const fields = { updatedBy: actingAdminId };
    for (const key of SCALAR_FIELDS) {
      if (Object.hasOwn(input, key)) fields[key] = input[key];
    }
    const result = await updateRule(ruleId, fields);
    await replaceScopeAndConditions(ruleId, result, input);
    return result;
  });

  invalidateRuleSetCache();
  await insertPricingRuleAuditLog({
    ruleId,
    ruleNameSnapshot: updated.name,
    ruleType: updated.rule_type,
    action: 'UPDATED',
    previousValue: existing,
    newValue: updated,
    adminUserId: actingAdminId,
  });

  const newProductIds = isLiveStatus(updated.status) ? await findProductIdsInRuleScope(updated) : [];
  const unionIds = Array.from(new Set([...oldProductIds, ...newProductIds]));
  if (unionIds.length > 0) {
    await enqueueReprice({ rule: updated, productIds: unionIds, trigger: 'RULE_UPDATED', requestedBy: actingAdminId });
  }

  return updated;
}

export async function activatePricingRule(ruleId, actingAdminId) {
  const existing = await findRuleById(ruleId);
  if (!existing) throw new NotFoundError('Pricing rule not found');

  const updated = await updateRule(ruleId, { status: 'ACTIVE', updatedBy: actingAdminId });
  invalidateRuleSetCache();
  await insertPricingRuleAuditLog({
    ruleId,
    ruleNameSnapshot: updated.name,
    ruleType: updated.rule_type,
    action: 'ACTIVATED',
    previousValue: { status: existing.status },
    newValue: { status: 'ACTIVE' },
    adminUserId: actingAdminId,
  });

  const productIds = await findProductIdsInRuleScope(updated);
  await enqueueReprice({ rule: updated, productIds, trigger: 'RULE_ACTIVATED', requestedBy: actingAdminId });
  return updated;
}

export async function disablePricingRule(ruleId, actingAdminId) {
  const existing = await findRuleById(ruleId);
  if (!existing) throw new NotFoundError('Pricing rule not found');

  // Resolved from the OLD (still-live) rule, before flipping status — once
  // disabled, findProductIdsInRuleScope would still work (scope rows are
  // untouched by a status change) but resolving first is the same
  // pre-write-scope discipline used everywhere else in this file.
  const productIds = isLiveStatus(existing.status) ? await findProductIdsInRuleScope(existing) : [];

  const updated = await updateRule(ruleId, { status: 'DISABLED', updatedBy: actingAdminId });
  invalidateRuleSetCache();
  await insertPricingRuleAuditLog({
    ruleId,
    ruleNameSnapshot: updated.name,
    ruleType: updated.rule_type,
    action: 'DEACTIVATED',
    previousValue: { status: existing.status },
    newValue: { status: 'DISABLED' },
    adminUserId: actingAdminId,
  });

  if (productIds.length > 0) {
    await enqueueReprice({ rule: updated, productIds, trigger: 'RULE_DISABLED', requestedBy: actingAdminId });
  }
  return updated;
}

// Resolve scope -> write the audit log + job row -> delete the rule. Both
// pricing_reprice_jobs.rule_id and pricing_rule_audit_logs.rule_id are
// ON DELETE SET NULL (never CASCADE), so the job still runs correctly and
// the audit trail survives the rule being gone — "never deleted, even when
// a rule is removed" is enforced by the FK, not just by convention.
export async function deletePricingRule(ruleId, actingAdminId) {
  const existing = await findRuleById(ruleId);
  if (!existing) throw new NotFoundError('Pricing rule not found');

  const productIds = isLiveStatus(existing.status) ? await findProductIdsInRuleScope(existing) : [];
  const job = productIds.length > 0
    ? await enqueueReprice({ rule: existing, productIds, trigger: 'RULE_DELETED', requestedBy: actingAdminId })
    : null;

  await insertPricingRuleAuditLog({
    ruleId,
    ruleNameSnapshot: existing.name,
    ruleType: existing.rule_type,
    action: 'DELETED',
    previousValue: existing,
    affectedProductCount: productIds.length,
    adminUserId: actingAdminId,
  });

  await deleteRule(ruleId);
  invalidateRuleSetCache();
  return { deleted: true, repriceJobId: job?.id ?? null };
}

// On-demand reprice for an already-live rule — the service-layer half of
// `POST /rules/:ruleId/reprice` (Phase 3's controller just calls this).
export async function triggerManualReprice(ruleId, actingAdminId) {
  const rule = await findRuleById(ruleId);
  if (!rule) throw new NotFoundError('Pricing rule not found');

  const productIds = await findProductIdsInRuleScope(rule);
  if (productIds.length === 0) {
    throw new AppError(400, 'This rule has no products in its current scope to reprice.');
  }
  return enqueueReprice({ rule, productIds, trigger: 'MANUAL', requestedBy: actingAdminId });
}
