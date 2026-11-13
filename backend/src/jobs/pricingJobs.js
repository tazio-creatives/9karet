import { boss, createQueueSafe } from './queue.js';
import { withTransaction } from '../config/db.js';
import { runGoldRateSync } from '../services/goldRateService.js';
import { insertPriceHistory } from '../repositories/productPriceHistory.repository.js';
import { findGoldProductsForRecalculation } from '../repositories/products.repository.js';
import { applyBaseProductPricing } from '../services/productsService.js';
import { invalidateProductsPagesBatch } from '../services/pageCacheInvalidation.js';
import { loadActiveRuleSet } from '../services/pricingRuleResolver.js';

export const JOB_GOLD_RATE_SYNC = 'gold-rate-sync';
export const JOB_RECALCULATE_GOLD = 'recalculate-gold-prices';

// Rate sync flow (spec: OroPocket primary / GoldAPI fallback / last-known
// rate, admin adjustment layer, Automatic/Manual mode, deviation guard —
// all handled by goldRateService.runGoldRateSync). Only enqueues the
// recalculation pass when a genuinely new rate was actually applied —
// a failed/rejected/manual-mode sync leaves cached prices exactly as they
// were, never stale-but-wrong and never a wasted recalculation pass.
async function goldRateSyncHandler(jobs) {
  const trigger = jobs?.[0]?.data?.trigger ?? 'CRON';
  const { applied } = await runGoldRateSync({ trigger });
  if (applied) {
    await boss.send(JOB_RECALCULATE_GOLD, {});
  }
}

// Every product_variants row is priced live via computeVariantPricing at
// read time (always querying the current gold rate) — nothing per-variant
// to recalculate here. What DOES need proactive recalculation is each
// product's own cached base price (used for listing display before a
// shopper picks a variant), re-derived from the product's own base
// configuration — applyBaseProductPricing already does exactly that, so this
// handler's job is just: for every affected product, re-run it and log the
// price-history delta.
// Per-product try/catch (Pricing Rule Management, Phase 2) — this loop used
// to have none, so a single product throwing (a missing gold rate for an
// purity, a data-integrity edge case) aborted recalculation for
// every other product in the same pass. One bad product must not block a
// gold-rate sync for the other ~2,000. The rule set is loaded once up front
// (not once per product, which loadActiveRuleSet's own 30s cache would
// mostly absorb anyway, but loading it once is still one query instead of
// up to 2,000).
async function recalculateGoldPricesHandler() {
  const products = await findGoldProductsForRecalculation();
  const ruleSet = await loadActiveRuleSet();
  const touched = [];
  const failures = [];

  for (const product of products) {
    try {
      const result = await applyBaseProductPricing(product.id, false, ruleSet);
      if (!result?.changed) continue;
      touched.push(product);
      await withTransaction((client) =>
        insertPriceHistory(client, {
          productId: product.id,
          oldSellingPrice: result.oldSellingPrice,
          newSellingPrice: result.newSellingPrice,
          goldRateId: null,
          reason: 'RATE_SYNC',
        }),
      );
    } catch (err) {
      failures.push(product.id);
      console.error(`[GOLD_RATE_SYNC] product ${product.id} failed to reprice:`, err);
    }
  }

  await invalidateProductsPagesBatch(touched);
  console.log(
    `[GOLD_RATE_SYNC] Products recalculated: ${touched.length}/${products.length}` +
      (failures.length ? `, ${failures.length} failed (see logs above)` : ''),
  );
}

export async function registerPricingWorkers() {
  // pg-boss v10 requires queues to be created explicitly before scheduling/
  // sending/working them — createQueue() is idempotent, safe on every boot.
  for (const name of [JOB_GOLD_RATE_SYNC, JOB_RECALCULATE_GOLD]) {
    await createQueueSafe(name);
  }

  await boss.work(JOB_GOLD_RATE_SYNC, goldRateSyncHandler);
  await boss.work(JOB_RECALCULATE_GOLD, recalculateGoldPricesHandler);
}
