// Primary metal-rate provider — OroPocket's public India gold/silver price
// endpoint. No API key required, but still only ever called from this
// backend (see goldRateService.js) — never exposed to the storefront.
//
// Response shape (verified live 2026-09-24):
//   { statusCode, data: { gold: { buy, sell, gst, currency, unit, change24h }, silver: {...}, timestamp } }
//
// CORRECTED 2026-09-26 (was wrong before this): `buy` is GST-INCLUSIVE, not
// exclusive. Proof: `buy - gst` lands within ~0.02% of `sell` on every fetch
// (buy = retail purchase price with GST, sell = GST-free buyback price, gst
// = the tax portion embedded in buy) — confirmed consistently across
// repeated live fetches, and cross-checked against GoldAPI's raw rate + 16%
// import duty (see metalRateProvider.goldapi.js), which lands within 0.04%
// of `buy - gst` but ~3% away from `buy` alone. The original comment here
// claimed `buy` was already exclusive based on `gst` being ~3% of `buy` —
// that ratio holds true under EITHER interpretation and doesn't actually
// distinguish them, so it was not real evidence. Using `buy` as-is silently
// baked GST into the stored base rate, which was then taxed AGAIN by
// Goldbox's own gst_percent in the pricing engine — a real double-GST bug
// that overpriced every gold product by ~3% in production before this fix.
// The correct GST-exclusive base rate is `buy - gst`.
import { env } from '../../config/env.js';

const EXPECTED_UNIT = 'gram';
const EXPECTED_CURRENCY = 'INR';

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export const oropocketMetalRateProvider = {
  async fetchRate(metal) {
    if (metal !== 'GOLD') {
      throw new Error(`oropocket metal rate provider does not support metal "${metal}"`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.metalRateFetchTimeoutMs);
    let response;
    try {
      response = await fetch(`${env.oropocketBaseUrl}/public/prices`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`OroPocket rate fetch timed out after ${env.metalRateFetchTimeoutMs}ms`);
      }
      throw new Error(`OroPocket rate fetch failed: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OroPocket rate fetch failed (${response.status}): ${body.slice(0, 500)}`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error('OroPocket rate fetch returned malformed (non-JSON) response');
    }

    const gold = payload?.data?.gold;
    if (!gold || typeof gold !== 'object') {
      throw new Error('OroPocket response missing data.gold');
    }

    const { buy, gst, currency, unit } = gold;
    if (!isFiniteNumber(buy) || buy <= 0) {
      throw new Error(`OroPocket gold.buy is not a valid positive rate: ${JSON.stringify(buy)}`);
    }
    if (!isFiniteNumber(gst) || gst < 0) {
      throw new Error(`OroPocket gold.gst is not a valid non-negative amount: ${JSON.stringify(gst)}`);
    }
    if (currency && currency !== EXPECTED_CURRENCY) {
      throw new Error(`OroPocket gold.currency unexpected: expected ${EXPECTED_CURRENCY}, got "${currency}"`);
    }
    if (unit && unit !== EXPECTED_UNIT) {
      throw new Error(`OroPocket gold.unit unexpected: expected ${EXPECTED_UNIT}, got "${unit}"`);
    }
    const timestamp = payload?.data?.timestamp;
    if (timestamp != null && Number.isNaN(new Date(timestamp).getTime())) {
      throw new Error(`OroPocket response timestamp is invalid: ${JSON.stringify(timestamp)}`);
    }

    const ratePerGram = Math.round((buy - gst) * 100) / 100;
    if (ratePerGram <= 0) {
      throw new Error(`OroPocket gold.buy - gold.gst produced a non-positive rate: ${ratePerGram}`);
    }
    return { ratePerGram, source: 'oropocket' };
  },
};
