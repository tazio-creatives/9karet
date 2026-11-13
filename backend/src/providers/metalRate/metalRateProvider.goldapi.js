// Real provider — GoldAPI.io. Credentials live only in backend env vars.
import { env } from '../../config/env.js';

const GOLDAPI_BASE_URL = 'https://www.goldapi.io/api';
const SYMBOLS = { GOLD: 'XAU' };

export const goldapiMetalRateProvider = {
  async fetchRate(metal) {
    const symbol = SYMBOLS[metal];
    if (!symbol) {
      throw new Error(`goldapi metal rate provider does not support metal "${metal}"`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.metalRateFetchTimeoutMs);
    let response;
    try {
      response = await fetch(`${GOLDAPI_BASE_URL}/${symbol}/INR`, {
        method: 'GET',
        headers: { 'x-access-token': env.goldapiAccessToken, Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`GoldAPI rate fetch timed out after ${env.metalRateFetchTimeoutMs}ms`);
      }
      throw new Error(`GoldAPI rate fetch failed: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GoldAPI rate fetch failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    const rawRate = data?.price_gram_24k;
    if (typeof rawRate !== 'number' || !Number.isFinite(rawRate) || rawRate <= 0) {
      throw new Error(`GoldAPI response missing a valid price_gram_24k: ${JSON.stringify(rawRate)}`);
    }
    // GoldAPI's price_gram_24k is the raw international (LBMA) spot price
    // just converted to INR — it does NOT include India's gold import duty,
    // unlike OroPocket's quote, which is an actual Indian domestic price.
    // Confirmed by direct comparison on 2026-09-24: GoldAPI ₹13,151.84/g vs
    // OroPocket ₹15,666.60/g (a ~19% gap) — adding this duty brought GoldAPI
    // to within ~2.7% of OroPocket, i.e. it explains nearly the entire gap.
    // Applied here (not in goldRateService) so every consumer of this
    // provider — the real fallback path and the side-by-side comparison log
    // alike — gets a duty-adjusted, genuinely comparable Indian rate.
    const rate = Math.round(rawRate * (1 + env.goldapiImportDutyPercent / 100) * 100) / 100;
    return { ratePerGram: rate, source: 'goldapi' };
  },
};
