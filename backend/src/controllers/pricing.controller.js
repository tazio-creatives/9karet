import { pricingPreviewSchema, priceLockSchema, goldRateSettingsSchema, manualGoldRateSchema } from '../validators/pricing.validators.js';
import * as pricingService from '../services/pricingService.js';
import { listGoldRateHistory } from '../repositories/goldRates.repository.js';
import { updateProduct } from '../repositories/products.repository.js';
import { boss } from '../jobs/queue.js';
import { JOB_GOLD_RATE_SYNC, JOB_RECALCULATE_GOLD } from '../jobs/pricingJobs.js';
import { NotFoundError } from '../utils/AppError.js';
import { invalidateProductPages } from '../services/pageCacheInvalidation.js';
import { getGoldRateOverview, updateGoldRateSettings, setManualGoldRate } from '../services/goldRateService.js';

export async function getGoldRates(req, res, next) {
  try {
    const [current, history] = await Promise.all([
      pricingService.getCurrentRatesSnapshot(),
      listGoldRateHistory({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 50,
      }),
    ]);
    res.json({ current, history: history.items, total: history.total });
  } catch (err) {
    next(err);
  }
}

// Manual "Sync Now"/"Refresh Rate" — enqueues the identical job the
// scheduled cron uses, so both paths run the exact same
// goldRateService.runGoldRateSync() code. Throttled at the route level
// (see pricing.routes.js) so repeated clicks can't spam OroPocket.
export async function syncGoldRates(req, res, next) {
  try {
    await boss.send(JOB_GOLD_RATE_SYNC, { trigger: 'MANUAL' });
    res.status(202).json({ message: 'Gold rate sync started' });
  } catch (err) {
    next(err);
  }
}

export async function getGoldRateSettings(req, res, next) {
  try {
    res.json(await getGoldRateOverview());
  } catch (err) {
    next(err);
  }
}

export async function putGoldRateSettings(req, res, next) {
  try {
    const input = goldRateSettingsSchema.parse(req.body);
    const wasManual = (await getGoldRateOverview()).settings?.source === 'MANUAL';
    const settings = await updateGoldRateSettings(input, req.admin.id);
    // Switching Manual -> Automatic should immediately fetch/reuse the
    // latest valid rate and recalculate, per spec §7 — reuse the same sync
    // job rather than duplicating its logic here.
    if (wasManual && settings.source === 'AUTOMATIC') {
      await boss.send(JOB_GOLD_RATE_SYNC, { trigger: 'MANUAL' });
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

export async function postManualGoldRate(req, res, next) {
  try {
    const { rate24k } = manualGoldRateSchema.parse(req.body);
    const derived = await setManualGoldRate(rate24k, req.admin.id);
    await boss.send(JOB_RECALCULATE_GOLD, {});
    res.json({ rates: derived });
  } catch (err) {
    next(err);
  }
}

export async function preview(req, res, next) {
  try {
    const input = pricingPreviewSchema.parse(req.body);
    const result = await pricingService.previewPricing(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function setPriceLock(req, res, next) {
  try {
    const { locked } = priceLockSchema.parse(req.body);
    const product = await updateProduct(req.params.id, { isPriceLocked: locked });
    if (!product) throw new NotFoundError('Product not found');
    await invalidateProductPages(product);
    res.json({ id: product.id, isPriceLocked: product.is_price_locked });
  } catch (err) {
    next(err);
  }
}
