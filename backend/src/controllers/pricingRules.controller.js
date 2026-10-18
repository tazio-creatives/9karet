import {
  createPricingRuleSchema,
  updatePricingRuleSchema,
  listPricingRulesQuerySchema,
  listPricingRuleAuditQuerySchema,
} from '../validators/pricingRules.validators.js';
import { findPricingRuleAuditLogs } from '../repositories/pricingRuleAudit.repository.js';
import {
  listRules,
  findRuleById,
  findRuleCategoryLinks,
  findRuleProductLinks,
  findRuleStoneTypeLinks,
  findRulePurityLinks,
  findRuleConditions,
} from '../repositories/pricingRules.repository.js';
import {
  findRepriceJobById,
  findActiveRepriceJobs,
  findRecentRepriceJobs,
} from '../repositories/repriceJobs.repository.js';
import {
  createPricingRule,
  updatePricingRule,
  activatePricingRule,
  disablePricingRule,
  deletePricingRule,
  triggerManualReprice,
} from '../services/pricingRuleService.js';
import { previewPricingRule } from '../services/pricingRulePreview.service.js';
import { NotFoundError } from '../utils/AppError.js';

function ruleSummaryDto(row) {
  return {
    id: row.id,
    ruleType: row.rule_type,
    name: row.name,
    scope: row.scope,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    purityScope: row.purity_scope,
    overrideMode: row.override_mode,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    priority: row.priority,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ruleDetailDto(row) {
  const [categoryLinks, productLinks, stoneTypeLinks, purityLinks, conditionRows] = await Promise.all([
    findRuleCategoryLinks([row.id]),
    findRuleProductLinks([row.id]),
    findRuleStoneTypeLinks([row.id]),
    findRulePurityLinks([row.id]),
    findRuleConditions([row.id]),
  ]);
  return {
    ...ruleSummaryDto(row),
    categoryIds: categoryLinks.map((r) => r.category_id),
    productIds: productLinks.map((r) => r.product_id),
    stoneTypeIds: stoneTypeLinks.map((r) => r.stone_type_id),
    purityValueIds: purityLinks.map((r) => r.purity_value_id),
    conditions: conditionRows.map((r) => ({
      conditionType: r.condition_type,
      stringValues: r.string_values,
      minValue: r.min_value != null ? Number(r.min_value) : null,
      maxValue: r.max_value != null ? Number(r.max_value) : null,
    })),
  };
}

function repriceJobDto(row) {
  return {
    id: row.id,
    ruleId: row.rule_id,
    ruleNameSnapshot: row.rule_name_snapshot,
    trigger: row.trigger,
    status: row.status,
    totalCount: row.total_count,
    processedCount: row.processed_count,
    changedCount: row.changed_count,
    failedCount: row.failed_count,
    failures: row.failures,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  };
}

export async function list(req, res, next) {
  try {
    const query = listPricingRulesQuerySchema.parse(req.query);
    const { items, total } = await listRules(query);
    // The list page's Stone Types column reads stoneTypeIds — one bulk
    // lookup for the whole page rather than a ruleDetailDto per row.
    const stoneTypeLinks = await findRuleStoneTypeLinks(items.map((r) => r.id));
    const rules = items.map((row) => ({
      ...ruleSummaryDto(row),
      stoneTypeIds: stoneTypeLinks.filter((l) => l.rule_id === row.id).map((l) => l.stone_type_id),
    }));
    res.json({ rules, total, page: query.page, limit: query.limit });
  } catch (err) {
    next(err);
  }
}

export async function get(req, res, next) {
  try {
    const rule = await findRuleById(req.params.ruleId);
    if (!rule) throw new NotFoundError('Pricing rule not found');
    res.json({ rule: await ruleDetailDto(rule) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const input = createPricingRuleSchema.parse(req.body);
    const rule = await createPricingRule(input, req.admin.id);
    res.status(201).json({ rule: await ruleDetailDto(rule) });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const input = updatePricingRuleSchema.parse(req.body);
    const rule = await updatePricingRule(req.params.ruleId, input, req.admin.id);
    res.json({ rule: await ruleDetailDto(rule) });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await deletePricingRule(req.params.ruleId, req.admin.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function activate(req, res, next) {
  try {
    const rule = await activatePricingRule(req.params.ruleId, req.admin.id);
    res.json({ rule: await ruleDetailDto(rule) });
  } catch (err) {
    next(err);
  }
}

export async function disable(req, res, next) {
  try {
    const rule = await disablePricingRule(req.params.ruleId, req.admin.id);
    res.json({ rule: await ruleDetailDto(rule) });
  } catch (err) {
    next(err);
  }
}

// POST /rules/preview — an unsaved payload, validated exactly like create.
export async function previewUnsaved(req, res, next) {
  try {
    const input = createPricingRuleSchema.parse(req.body);
    const result = await previewPricingRule(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// POST /rules/:ruleId/preview — a saved rule, re-simulated (e.g. "what would
// happen if I reactivated/repriced this right now"). Reconstructs the same
// input shape previewPricingRule expects from the rule's own row + links,
// so both preview entry points run through the identical function.
export async function previewSaved(req, res, next) {
  try {
    const rule = await findRuleById(req.params.ruleId);
    if (!rule) throw new NotFoundError('Pricing rule not found');
    const detail = await ruleDetailDto(rule);
    const result = await previewPricingRule({
      ruleType: detail.ruleType,
      name: detail.name,
      scope: detail.scope,
      discountType: detail.discountType,
      discountValue: detail.discountValue,
      purityScope: detail.purityScope,
      purityValueIds: detail.purityValueIds,
      overrideMode: detail.overrideMode,
      priority: detail.priority,
      categoryIds: detail.categoryIds,
      productIds: detail.productIds,
      stoneTypeIds: detail.stoneTypeIds,
      conditions: detail.conditions,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function reprice(req, res, next) {
  try {
    const job = await triggerManualReprice(req.params.ruleId, req.admin.id);
    res.status(202).json({ repriceJobId: job.id });
  } catch (err) {
    next(err);
  }
}

export async function getRepriceJob(req, res, next) {
  try {
    const job = await findRepriceJobById(req.params.jobId);
    if (!job) throw new NotFoundError('Reprice job not found');
    res.json({ job: repriceJobDto(job) });
  } catch (err) {
    next(err);
  }
}

export async function listRepriceJobs(req, res, next) {
  try {
    const jobs = req.query.active === 'true' ? await findActiveRepriceJobs() : await findRecentRepriceJobs({});
    res.json({ jobs: jobs.map(repriceJobDto) });
  } catch (err) {
    next(err);
  }
}

function auditLogDto(row) {
  return {
    id: row.id,
    ruleId: row.rule_id,
    ruleNameSnapshot: row.rule_name_snapshot,
    ruleType: row.rule_type,
    action: row.action,
    previousValue: row.previous_value,
    newValue: row.new_value,
    affectedProductCount: row.affected_product_count,
    productId: row.product_id,
    productName: row.product_name,
    productSku: row.product_sku,
    adminUserId: row.admin_user_id,
    // Prefers the live admin's current name; falls back to whatever was
    // snapshotted at write time (admin_user_id is ON DELETE SET NULL, so a
    // removed admin's row would otherwise show nothing at all).
    adminName: row.admin_full_name ?? row.admin_email_snapshot ?? null,
    createdAt: row.created_at,
  };
}

export async function listAudit(req, res, next) {
  try {
    const query = listPricingRuleAuditQuerySchema.parse(req.query);
    const { page, limit, ...filters } = query;
    const { items, total } = await findPricingRuleAuditLogs({ ...filters, page, limit });
    res.json({ entries: items.map(auditLogDto), total, page, limit });
  } catch (err) {
    next(err);
  }
}
