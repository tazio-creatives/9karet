import { boss, createQueueSafe } from './queue.js';
import { withTransaction } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { findProductsForRepricing } from '../repositories/products.repository.js';
import { insertPriceHistory } from '../repositories/productPriceHistory.repository.js';
import { invalidateProductsPagesBatch } from '../services/pageCacheInvalidation.js';
import { applyBaseProductPricing } from '../services/productsService.js';
import { loadActiveRuleSet, invalidateRuleSetCache } from '../services/pricingRuleResolver.js';
import {
  enqueueRepriceJob,
  claimRepriceJob,
  bumpRepriceCounters,
  finishRepriceJob,
} from '../repositories/repriceJobs.repository.js';
import { insertPricingRuleAuditLog } from '../repositories/pricingRuleAudit.repository.js';
import { findLiveRules, findProductIdsInRuleScope, updateRule } from '../repositories/pricingRules.repository.js';

export const JOB_PRICING_RULE_REPRICE = 'pricing-rule-reprice';
export const JOB_PRICING_RULE_STATUS_SWEEP = 'pricing-rule-status-sweep';

const REPRICE_BATCH_SIZE = 100;
const REPRICE_CONCURRENCY = 4;

// The one place that both admin-triggered rule lifecycle actions
// (pricingRuleService.js) and the status-sweep cron below go through to
// start a repricing run — owns the "insert the job row, then hand it to
// pg-boss" sequence so there's exactly one of each. `rule` may be null for a
// MANUAL trigger. A rule with an empty resolved scope enqueues nothing (a
// GLOBAL rule with zero products, or a Product-scope rule whose product was
// deleted) — there is nothing to reprice, so no job/audit noise either.
//
// Duplicate prevention is the pricing_reprice_jobs_one_active partial unique
// index (repriceJobs migration): a 23505 here means a job for this exact
// rule (or the rule-less slot) is already QUEUED/RUNNING — translated to a
// 409 so an admin action gets a clear rejection, and callers that run
// unattended (the sweep) can catch AppError and just skip that rule this
// tick rather than crash the whole sweep.
export async function enqueueReprice({ rule, productIds, trigger, requestedBy = null }) {
  if (!productIds.length) return null;
  let job;
  try {
    job = await enqueueRepriceJob({
      ruleId: rule?.id ?? null,
      ruleNameSnapshot: rule?.name ?? null,
      trigger,
      productIds,
      requestedBy,
    });
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError(409, 'A repricing job for this rule is already running.');
    }
    throw err;
  }
  await boss.send(JOB_PRICING_RULE_REPRICE, { repriceJobId: job.id }, { singletonKey: job.id });
  return job;
}

function chunked(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// Runs `fn` over `items` with at most `limit` in flight at once — same tiny
// bounded pool as aiStudioJob.js's runWithConcurrency (not shared/exported
// from there; duplicating a 9-line helper is simpler than cross-importing a
// private function from an unrelated job file).
async function runWithConcurrency(items, limit, fn) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Per-item isolated (modeled on aiStudioJob.js's generateOneAsset, NOT on
// pricingJobs.js's unguarded loop, which aborts the whole batch on one
// failure) — a single bad product must never abort repricing the other
// ~2,039. pg-boss v10's work() callback always receives an array.
// Exported (not called directly by pg-boss's dispatch alone) so it can be
// invoked directly in tests with a synthetic `[{ data: { repriceJobId } }]`
// — the exact shape pg-boss itself calls it with.
export async function repriceHandler(jobs) {
  const [job] = jobs;
  const { repriceJobId } = job.data;

  const repriceJob = await claimRepriceJob(repriceJobId);
  if (!repriceJob) return; // already claimed/finished by a prior delivery

  invalidateRuleSetCache();
  const ruleSet = await loadActiveRuleSet();

  const touched = []; // raw product rows (id, category_id, slug) for the batched cache bust
  const failures = [];

  for (const chunk of chunked(repriceJob.product_ids, REPRICE_BATCH_SIZE)) {
    const rows = await findProductsForRepricing(chunk);
    let changedInChunk = 0;
    let failedInChunk = 0;

    await runWithConcurrency(rows, REPRICE_CONCURRENCY, async (product) => {
      try {
        const result = await applyBaseProductPricing(product.id, product.is_price_locked, ruleSet);
        if (result?.changed) {
          changedInChunk++;
          touched.push(product);
          await withTransaction((client) =>
            insertPriceHistory(client, {
              productId: product.id,
              oldSellingPrice: result.oldSellingPrice,
              newSellingPrice: result.newSellingPrice,
              goldRateId: null,
              reason: 'PRICING_RULE',
            }),
          );
        }
      } catch (err) {
        failedInChunk++;
        failures.push({ productId: product.id, sku: product.sku, message: err.message });
      }
    });

    await bumpRepriceCounters(repriceJobId, { processed: rows.length, changed: changedInChunk, failed: failedInChunk });
  }

  if (touched.length > 0) await invalidateProductsPagesBatch(touched);

  const finalStatus = failures.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
  await finishRepriceJob(repriceJobId, { status: finalStatus, failures: failures.slice(0, 200) });

  await insertPricingRuleAuditLog({
    ruleId: repriceJob.rule_id,
    ruleNameSnapshot: repriceJob.rule_name_snapshot ?? '(deleted rule)',
    action: failures.length > 0 ? 'REPRICE_FAILED' : 'REPRICE_COMPLETED',
    affectedProductCount: touched.length,
    newValue: { processed: repriceJob.product_ids.length, changed: touched.length, failed: failures.length },
  });
}

// Cron, every 5 minutes by default (env.pricingRuleStatusSweepCron):
// SCHEDULED -> ACTIVE once starts_at has passed, ACTIVE -> EXPIRED once
// ends_at has passed. Resolution itself never depends on this having run —
// isLive() (pricingRuleResolver.js) derives real liveness from the dates
// directly — so a missed or delayed tick is a UI/audit-log freshness gap,
// never a pricing bug. Each transition gets its own reprice via the same
// enqueueReprice admin-triggered actions use, so a rule expiring
// un-suppresses/un-applies its effect on schedule rather than only the next
// time someone happens to touch an affected product. Each rule's transition
// is isolated in its own try/catch — one rule hitting the duplicate-job
// guard (or any other error) must not stop the sweep from processing the
// rest.
async function statusSweepHandler() {
  const now = new Date();
  const liveRules = await findLiveRules(); // status IN ('ACTIVE', 'SCHEDULED')

  for (const rule of liveRules) {
    try {
      if (rule.status === 'SCHEDULED' && rule.starts_at && new Date(rule.starts_at) <= now) {
        await updateRule(rule.id, { status: 'ACTIVE' });
        invalidateRuleSetCache();
        await insertPricingRuleAuditLog({ ruleId: rule.id, ruleNameSnapshot: rule.name, ruleType: rule.rule_type, action: 'ACTIVATED' });
        const productIds = await findProductIdsInRuleScope(rule);
        await enqueueReprice({ rule, productIds, trigger: 'RULE_ACTIVATED' });
      } else if (rule.status === 'ACTIVE' && rule.ends_at && new Date(rule.ends_at) <= now) {
        await updateRule(rule.id, { status: 'EXPIRED' });
        invalidateRuleSetCache();
        await insertPricingRuleAuditLog({ ruleId: rule.id, ruleNameSnapshot: rule.name, ruleType: rule.rule_type, action: 'EXPIRED' });
        const productIds = await findProductIdsInRuleScope(rule);
        await enqueueReprice({ rule, productIds, trigger: 'RULE_EXPIRED' });
      }
    } catch (err) {
      console.error(`[PRICING_RULE_STATUS_SWEEP] rule ${rule.id} transition failed:`, err);
    }
  }
}

export async function registerPricingRuleWorkers() {
  await createQueueSafe(JOB_PRICING_RULE_REPRICE, { retryLimit: 0 }); // a half-done reprice must never be silently restarted
  await createQueueSafe(JOB_PRICING_RULE_STATUS_SWEEP);
  await boss.work(JOB_PRICING_RULE_REPRICE, repriceHandler);
  await boss.work(JOB_PRICING_RULE_STATUS_SWEEP, statusSweepHandler);
}
