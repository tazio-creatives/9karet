// Orchestrates the gold-rate sync: provider priority (OroPocket -> GoldAPI
// fallback -> last known valid rate), retry/backoff, validation, the
// extreme-movement sanity check, the optional admin adjustment layer, and
// Automatic/Manual mode. Deliberately does NOT touch product pricing math —
// it only ever produces a base 24K rate and hands off to the existing,
// unmodified deriveRatesFromBase24k()/insertGoldRates()/recalculation flow.
//
// All external calls are injectable via the `deps` param (matching this
// repo's existing test convention of passing explicit params rather than
// mocking modules — see deliveryEstimateService.js/its tests) so
// runGoldRateSync can be unit-tested without hitting real APIs or a DB.
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { oropocketMetalRateProvider } from '../providers/metalRate/metalRateProvider.oropocket.js';
import { goldapiMetalRateProvider } from '../providers/metalRate/metalRateProvider.goldapi.js';
import { stubMetalRateProvider } from '../providers/metalRate/metalRateProvider.stub.js';
import { deriveRatesFromBase24k } from './pricingService.js';
import { insertGoldRates, getCurrentGoldRate, getCurrentGoldRates } from '../repositories/goldRates.repository.js';
import { getGoldRateSettings, updateGoldRateSettings as updateGoldRateSettingsRepo } from '../repositories/goldRateSettings.repository.js';
import { insertGoldRateSyncRun, getLatestGoldRateSyncRun } from '../repositories/goldRateSyncRuns.repository.js';

const BASE_PURITY = '24K';

export function computeEffectiveRate(baseRate, adjustmentType, adjustmentValue) {
  let effective;
  if (adjustmentType === 'FIXED') {
    effective = baseRate + Number(adjustmentValue);
  } else if (adjustmentType === 'PERCENTAGE') {
    effective = baseRate + (baseRate * Number(adjustmentValue)) / 100;
  } else {
    effective = baseRate;
  }
  // Same rounding convention as deriveRatesFromBase24k/round2 elsewhere in
  // pricingService.js — no Decimal/BigInt library exists in this project.
  return Math.round(effective * 100) / 100;
}

export function checkDeviation(newRate, lastRate, maxDeviationPercent) {
  if (!(lastRate > 0)) return { exceeds: false, diffPercent: 0 };
  const diffPercent = (Math.abs(newRate - lastRate) / lastRate) * 100;
  return { exceeds: diffPercent > maxDeviationPercent, diffPercent };
}

async function fetchWithRetry(fn, { retries = 2, baseDelayMs = 400 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}

function formatRate(rate) {
  return rate == null ? 'n/a' : `₹${Number(rate).toFixed(2)}/g`;
}

function formatAdjustment(type, value) {
  if (type === 'FIXED') return `${value >= 0 ? '+' : ''}₹${value}/g`;
  if (type === 'PERCENTAGE') return `${value >= 0 ? '+' : ''}${value}%`;
  return 'none';
}

function logSyncSuccess({ trigger, provider, baseRate, adjustmentType, adjustmentValue, effectiveRate, durationMs }) {
  console.log(
    `[GOLD_RATE_SYNC]\n` +
      `Trigger: ${trigger}\n` +
      `Provider: ${provider}\n` +
      `External Rate: ${formatRate(baseRate)}\n` +
      `Adjustment: ${formatAdjustment(adjustmentType, adjustmentValue)}\n` +
      `Effective Rate: ${formatRate(effectiveRate)}\n` +
      `Status: SUCCESS\n` +
      `Duration: ${durationMs}ms`,
  );
}

function logSyncSkippedOrFailed({ trigger, status, primaryError, fallbackProvider, fallbackStatus, fallbackError, rejectedReason }) {
  console.error(
    `[GOLD_RATE_SYNC_ERROR]\n` +
      `Trigger: ${trigger}\n` +
      `Provider: OroPocket\n` +
      `Status: ${status}\n` +
      (primaryError ? `Error: ${primaryError}\n` : '') +
      (rejectedReason ? `Rejected: ${rejectedReason}\n` : '') +
      (fallbackProvider ? `Fallback: ${fallbackProvider}\nFallback Status: ${fallbackStatus}${fallbackError ? ` (${fallbackError})` : ''}` : 'Fallback: none'),
  );
}

// Main entry point — called by both the 15-minute cron job and the admin
// "Refresh Rate" button (pricingJobs.js's goldRateSyncHandler). Returns
// {applied, syncRun, effectiveRate24k} — `applied` tells the caller whether
// a genuinely new rate was saved and product recalculation should run.
export async function runGoldRateSync({ trigger = 'CRON', deps = {} } = {}) {
  const start = Date.now();
  const {
    fetchOropocket = () =>
      env.metalRateProvider === 'stub'
        ? stubMetalRateProvider.fetchRate('GOLD')
        : oropocketMetalRateProvider.fetchRate('GOLD'),
    fetchGoldapi = () => goldapiMetalRateProvider.fetchRate('GOLD'),
    getSettings = getGoldRateSettings,
    getLastRate = () => getCurrentGoldRate(BASE_PURITY),
    saveRates = insertGoldRates,
    saveSyncRun = insertGoldRateSyncRun,
    comparisonLoggingEnabled = env.goldRateComparisonLoggingEnabled,
    retries = env.metalRateFetchRetries,
    retryBaseDelayMs = env.metalRateRetryBaseDelayMs,
  } = deps;

  const settings = await getSettings();
  const lastRateRow = await getLastRate();
  const lastValidRate = lastRateRow ? Number(lastRateRow.rate_per_gram) : null;

  // Manual mode: pricing keeps using whatever rate the admin last entered
  // (the latest gold_rates row, source='manual') — never overwritten by the
  // API here. We still opportunistically fetch OroPocket, comparison-only,
  // so the admin panel can show "API Rate" for reference (spec §7).
  if (settings?.source === 'MANUAL') {
    let primaryRate = null;
    let primaryError = null;
    let primaryStatus = 'SKIPPED';
    if (comparisonLoggingEnabled) {
      try {
        const r = await fetchWithRetry(fetchOropocket, { retries, baseDelayMs: retryBaseDelayMs });
        primaryRate = r.ratePerGram;
        primaryStatus = 'SUCCESS';
      } catch (err) {
        primaryError = err.message;
        primaryStatus = 'FAILED';
      }
    }
    const syncRun = await saveSyncRun({
      trigger,
      primaryProvider: 'oropocket',
      primaryStatus,
      primaryRate,
      primaryError,
      resolvedProvider: 'manual',
      baseRate24k: lastValidRate,
      adjustmentType: 'NONE',
      adjustmentValue: 0,
      effectiveRate24k: lastValidRate,
      status: 'SUCCESS',
      applied: false,
      durationMs: Date.now() - start,
    });
    return { applied: false, syncRun, effectiveRate24k: lastValidRate };
  }

  // Automatic mode.
  let primaryRate = null;
  let primaryError = null;
  let primaryStatus;
  try {
    const r = await fetchWithRetry(fetchOropocket, { retries, baseDelayMs: retryBaseDelayMs });
    primaryRate = r.ratePerGram;
    primaryStatus = 'SUCCESS';
  } catch (err) {
    primaryError = err.message;
    primaryStatus = 'FAILED';
  }

  let fallbackProvider = null;
  let fallbackStatus = null;
  let fallbackRate = null;
  let fallbackError = null;
  let resolvedProvider = null;
  let baseRate = null;

  if (primaryStatus === 'SUCCESS') {
    resolvedProvider = 'oropocket';
    baseRate = primaryRate;
    // Side-by-side comparison logging (spec §13) — best-effort, never blocks
    // or fails the sync even if GoldAPI is down.
    if (comparisonLoggingEnabled) {
      fallbackProvider = 'goldapi';
      try {
        const r = await fetchGoldapi();
        fallbackRate = r.ratePerGram;
        fallbackStatus = 'SUCCESS';
      } catch (err) {
        fallbackError = err.message;
        fallbackStatus = 'FAILED';
      }
    }
  } else {
    // OroPocket exhausted its retries — fall back to GoldAPI for real.
    fallbackProvider = 'goldapi';
    try {
      const r = await fetchGoldapi();
      fallbackRate = r.ratePerGram;
      fallbackStatus = 'SUCCESS';
      resolvedProvider = 'goldapi';
      baseRate = fallbackRate;
    } catch (err) {
      fallbackError = err.message;
      fallbackStatus = 'FAILED';
    }
  }

  const adjustmentType = settings?.adjustment_type ?? 'NONE';
  const adjustmentValue = Number(settings?.adjustment_value ?? 0);
  const maxDeviationPercent = Number(settings?.max_deviation_percent ?? env.goldRateMaxDeviationPercent);

  if (baseRate == null) {
    // Both providers failed — keep using the last known valid rate. No new
    // gold_rates row is inserted, so pricing simply keeps reading the
    // existing latest row (never zero/null, never broken checkout).
    const syncRun = await saveSyncRun({
      trigger,
      primaryProvider: 'oropocket',
      primaryStatus,
      primaryRate,
      primaryError,
      fallbackProvider,
      fallbackStatus,
      fallbackRate,
      fallbackError,
      resolvedProvider: lastValidRate != null ? 'last_known' : null,
      baseRate24k: lastValidRate,
      adjustmentType,
      adjustmentValue,
      effectiveRate24k: lastValidRate,
      status: 'FAILED',
      applied: false,
      rejectedReason: lastValidRate == null ? 'NO_LAST_KNOWN_RATE_AVAILABLE' : null,
      durationMs: Date.now() - start,
    });
    logSyncSkippedOrFailed({ trigger, status: 'FAILED', primaryError, fallbackProvider, fallbackStatus, fallbackError });
    return { applied: false, syncRun, effectiveRate24k: lastValidRate };
  }

  const effectiveRate = computeEffectiveRate(baseRate, adjustmentType, adjustmentValue);

  if (lastValidRate != null) {
    const { exceeds, diffPercent } = checkDeviation(effectiveRate, lastValidRate, maxDeviationPercent);
    if (exceeds) {
      const rejectedReason = `Rate moved ${diffPercent.toFixed(2)}% (max allowed ${maxDeviationPercent}%) — held for review, previous rate retained`;
      const syncRun = await saveSyncRun({
        trigger,
        primaryProvider: 'oropocket',
        primaryStatus,
        primaryRate,
        primaryError,
        fallbackProvider,
        fallbackStatus,
        fallbackRate,
        fallbackError,
        resolvedProvider,
        baseRate24k: baseRate,
        adjustmentType,
        adjustmentValue,
        effectiveRate24k: effectiveRate,
        status: 'REJECTED',
        applied: false,
        rejectedReason,
        durationMs: Date.now() - start,
      });
      logSyncSkippedOrFailed({ trigger, status: 'REJECTED', primaryError: rejectedReason, fallbackProvider: null });
      return { applied: false, syncRun, effectiveRate24k: lastValidRate };
    }
  }

  const derived = deriveRatesFromBase24k(effectiveRate);
  await saveRates(derived, resolvedProvider);

  const syncRun = await saveSyncRun({
    trigger,
    primaryProvider: 'oropocket',
    primaryStatus,
    primaryRate,
    primaryError,
    fallbackProvider,
    fallbackStatus,
    fallbackRate,
    fallbackError,
    resolvedProvider,
    baseRate24k: baseRate,
    adjustmentType,
    adjustmentValue,
    effectiveRate24k: effectiveRate,
    status: 'SUCCESS',
    applied: true,
    durationMs: Date.now() - start,
  });

  logSyncSuccess({
    trigger,
    provider: resolvedProvider,
    baseRate,
    adjustmentType,
    adjustmentValue,
    effectiveRate,
    durationMs: Date.now() - start,
  });

  return { applied: true, syncRun, effectiveRate24k: effectiveRate };
}

export async function getGoldRateOverview() {
  const [settings, currentRates, latestSyncRun] = await Promise.all([
    getGoldRateSettings(),
    getCurrentGoldRates(),
    getLatestGoldRateSyncRun(),
  ]);
  return { settings, currentRates, latestSyncRun };
}

const VALID_ADJUSTMENT_TYPES = new Set(['NONE', 'FIXED', 'PERCENTAGE']);
const VALID_SOURCES = new Set(['AUTOMATIC', 'MANUAL']);

export async function updateGoldRateSettings(input, adminId) {
  const fields = {};
  if (Object.hasOwn(input, 'source')) {
    if (!VALID_SOURCES.has(input.source)) throw new AppError(400, `Invalid source "${input.source}"`);
    fields.source = input.source;
  }
  if (Object.hasOwn(input, 'adjustmentType')) {
    if (!VALID_ADJUSTMENT_TYPES.has(input.adjustmentType)) {
      throw new AppError(400, `Invalid adjustmentType "${input.adjustmentType}"`);
    }
    fields.adjustmentType = input.adjustmentType;
  }
  if (Object.hasOwn(input, 'adjustmentValue')) {
    if (!Number.isFinite(input.adjustmentValue)) throw new AppError(400, 'adjustmentValue must be a number');
    fields.adjustmentValue = input.adjustmentValue;
  }
  if (Object.hasOwn(input, 'maxDeviationPercent')) {
    if (!Number.isFinite(input.maxDeviationPercent) || input.maxDeviationPercent <= 0) {
      throw new AppError(400, 'maxDeviationPercent must be a positive number');
    }
    fields.maxDeviationPercent = input.maxDeviationPercent;
  }
  return updateGoldRateSettingsRepo(fields, adminId);
}

// Manual mode's "admin enters the applicable gold rate" (spec §7) — bypasses
// the API/adjustment layer entirely, derives the other purities from the
// existing deriveRatesFromBase24k() exactly like the automatic path.
export async function setManualGoldRate(rate24k, adminId) {
  if (!Number.isFinite(rate24k) || rate24k <= 0) {
    throw new AppError(400, 'A valid positive 24K gold rate is required');
  }
  const derived = deriveRatesFromBase24k(rate24k);
  await insertGoldRates(derived, 'manual');
  await insertGoldRateSyncRun({
    trigger: 'MANUAL',
    primaryProvider: 'manual',
    primaryStatus: 'SUCCESS',
    primaryRate: rate24k,
    resolvedProvider: 'manual',
    baseRate24k: rate24k,
    adjustmentType: 'NONE',
    adjustmentValue: 0,
    effectiveRate24k: rate24k,
    status: 'SUCCESS',
    applied: true,
    durationMs: 0,
  });
  console.log(`[GOLD_RATE_SYNC]\nTrigger: MANUAL\nProvider: admin\nEffective Rate: ${formatRate(rate24k)}\nStatus: SUCCESS\nAdmin: ${adminId}`);
  return derived;
}
