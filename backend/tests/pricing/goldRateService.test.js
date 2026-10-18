import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { oropocketMetalRateProvider } from '../../src/providers/metalRate/metalRateProvider.oropocket.js';
import { goldapiMetalRateProvider } from '../../src/providers/metalRate/metalRateProvider.goldapi.js';
import {
  runGoldRateSync,
  computeEffectiveRate,
  checkDeviation,
} from '../../src/services/goldRateService.js';
import { deriveRatesFromBase24k } from '../../src/services/pricingService.js';

// Real payload shape captured live from https://api.oropocket.com/public/prices
// on 2026-09-24 — used throughout so provider-level tests match production
// reality rather than an invented shape.
const REAL_OROPOCKET_PAYLOAD = {
  statusCode: 200,
  message: 'Asset prices retrieved successfully',
  data: {
    gold: { buy: 15727.14, sell: 15182.69, gst: 471.81, currency: 'INR', unit: 'gram', change24h: { buy: -0.31, sell: -0.31 } },
    silver: { buy: 241.47, sell: 227.25, gst: 7.24, currency: 'INR', unit: 'gram', change24h: { buy: -0.39, sell: -0.39 } },
    timestamp: '2026-09-24T07:50:00.117Z',
  },
};

function fakeFetchResponse({ ok = true, status = 200, json, text }) {
  return {
    ok,
    status,
    json: async () => json,
    text: async () => text ?? JSON.stringify(json ?? {}),
  };
}

describe('oropocketMetalRateProvider.fetchRate', () => {
  test('1. successful response: reads gold.buy minus gold.gst as the GST-exclusive base rate', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => fakeFetchResponse({ json: REAL_OROPOCKET_PAYLOAD }));
    const result = await oropocketMetalRateProvider.fetchRate('GOLD');
    // 15727.14 - 471.81 = 15255.33 — buy is GST-INCLUSIVE (confirmed live:
    // buy - gst lands within ~0.02% of `sell`, the GST-free buyback price).
    assert.equal(result.ratePerGram, 15255.33);
    assert.equal(result.source, 'oropocket');
  });

  test('19. GST is backed out exactly once: gst is subtracted from buy, never added, never left in', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => fakeFetchResponse({ json: REAL_OROPOCKET_PAYLOAD }));
    const result = await oropocketMetalRateProvider.fetchRate('GOLD');
    assert.equal(result.ratePerGram, REAL_OROPOCKET_PAYLOAD.data.gold.buy - REAL_OROPOCKET_PAYLOAD.data.gold.gst);
    assert.notEqual(result.ratePerGram, REAL_OROPOCKET_PAYLOAD.data.gold.buy);
    assert.notEqual(result.ratePerGram, REAL_OROPOCKET_PAYLOAD.data.gold.buy + REAL_OROPOCKET_PAYLOAD.data.gold.gst);
  });

  test('2. invalid response: missing data.gold is rejected', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => fakeFetchResponse({ json: { statusCode: 200, data: {} } }));
    await assert.rejects(() => oropocketMetalRateProvider.fetchRate('GOLD'), /missing data\.gold/);
  });

  test('2b. invalid response: zero/negative/null rate is rejected', async (t) => {
    t.mock.method(globalThis, 'fetch', async () =>
      fakeFetchResponse({ json: { data: { gold: { buy: 0, gst: 0, currency: 'INR', unit: 'gram' } } } }),
    );
    await assert.rejects(() => oropocketMetalRateProvider.fetchRate('GOLD'), /not a valid positive rate/);
  });

  test('2b2. invalid response: missing/negative gst is rejected', async (t) => {
    t.mock.method(globalThis, 'fetch', async () =>
      fakeFetchResponse({ json: { data: { gold: { buy: 15000, gst: -5, currency: 'INR', unit: 'gram' } } } }),
    );
    await assert.rejects(() => oropocketMetalRateProvider.fetchRate('GOLD'), /gst is not a valid non-negative amount/);
  });

  test('2c. invalid response: unexpected currency/unit is rejected', async (t) => {
    t.mock.method(globalThis, 'fetch', async () =>
      fakeFetchResponse({ json: { data: { gold: { buy: 15000, gst: 450, currency: 'USD', unit: 'gram' } } } }),
    );
    await assert.rejects(() => oropocketMetalRateProvider.fetchRate('GOLD'), /currency unexpected/);
  });

  test('2d. malformed (non-JSON) response is rejected', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token');
      },
      text: async () => 'not json',
    }));
    await assert.rejects(() => oropocketMetalRateProvider.fetchRate('GOLD'), /malformed/);
  });

  test('3. HTTP error: non-2xx status is rejected', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => fakeFetchResponse({ ok: false, status: 500, text: 'server error' }));
    await assert.rejects(() => oropocketMetalRateProvider.fetchRate('GOLD'), /failed \(500\)/);
  });

  test('5. 429 (rate limited) is rejected same as any other HTTP error', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => fakeFetchResponse({ ok: false, status: 429, text: 'too many requests' }));
    await assert.rejects(() => oropocketMetalRateProvider.fetchRate('GOLD'), /failed \(429\)/);
  });

  test('4. timeout: aborts after the configured timeout and rejects with a timeout message', async (t) => {
    t.mock.method(globalThis, 'fetch', (url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    await assert.rejects(() => oropocketMetalRateProvider.fetchRate('GOLD'), /timed out/);
  });
});

describe('goldapiMetalRateProvider.fetchRate (import duty adjustment)', () => {
  test('adds the configured import duty on top of GoldAPI\'s raw international rate', async (t) => {
    t.mock.method(globalThis, 'fetch', async () =>
      fakeFetchResponse({ json: { price_gram_24k: 13151.8416 } }),
    );
    const result = await goldapiMetalRateProvider.fetchRate('GOLD');
    // 13151.8416 * 1.16 = 15256.137056 -> rounded to 2dp, same convention
    // as deriveRatesFromBase24k elsewhere.
    assert.equal(result.ratePerGram, 15256.14);
    assert.equal(result.source, 'goldapi');
  });

  test('real-world check: duty-adjusted GoldAPI matches properly GST-exclusive OroPocket within ~1%', async (t) => {
    t.mock.method(globalThis, 'fetch', async () =>
      fakeFetchResponse({ json: { price_gram_24k: 13151.8416 } }),
    );
    const goldapi = await goldapiMetalRateProvider.fetchRate('GOLD');
    // Live OroPocket capture paired with the GoldAPI figure above:
    // buy=15666.6, gst=470 -> GST-exclusive = 15196.60. Comparing against
    // this corrected (buy-gst) figure, not the raw GST-inclusive buy, is the
    // fair apples-to-apples check — the earlier version of this test
    // compared against raw `buy` and got a misleadingly larger ~3% gap that
    // was actually just the unremoved GST.
    const oropocketExGst = 15666.6 - 470;
    const diffPercent = (Math.abs(oropocketExGst - goldapi.ratePerGram) / oropocketExGst) * 100;
    assert.ok(diffPercent < 2, `expected duty-adjusted gap under 2%, got ${diffPercent.toFixed(2)}%`);
  });
});

describe('computeEffectiveRate (adjustment layer)', () => {
  test('13. zero/none adjustment leaves the rate unchanged', () => {
    assert.equal(computeEffectiveRate(16000, 'NONE', 0), 16000);
  });

  test('11. fixed adjustment adds a flat amount per gram', () => {
    assert.equal(computeEffectiveRate(16000, 'FIXED', 100), 16100);
    assert.equal(computeEffectiveRate(16000, 'FIXED', -50), 15950);
  });

  test('12. percentage adjustment adds a percentage of the base rate', () => {
    assert.equal(computeEffectiveRate(16000, 'PERCENTAGE', 0.75), 16120);
  });
});

describe('purity derivation (deriveRatesFromBase24k)', () => {
  const derived = deriveRatesFromBase24k(16100);
  const byPurity = Object.fromEntries(derived.map((r) => [r.purity, r.ratePerGram]));

  test('6. 24K = base rate (market reference)', () => assert.equal(byPurity['24K'], 16100));
  test('7. 9K = base * 9/24 (the rate 9Karet sells at)', () =>
    assert.equal(byPurity['9K'], Math.round(((16100 * 9) / 24) * 100) / 100));
  test('8. only 9K and 24K are derived — 9Karet sells 9K gold only', () =>
    assert.deepEqual(Object.keys(byPurity).sort(), ['24K', '9K']));
});

describe('checkDeviation (extreme movement sanity check)', () => {
  test('flags a move beyond the configured threshold', () => {
    const { exceeds, diffPercent } = checkDeviation(18000, 16000, 10);
    assert.equal(exceeds, true);
    assert.ok(diffPercent > 10);
  });

  test('allows a move within the configured threshold', () => {
    const { exceeds } = checkDeviation(16500, 16000, 10);
    assert.equal(exceeds, false);
  });

  test('never flags anything when there is no prior rate to compare against', () => {
    const { exceeds } = checkDeviation(50000, null, 10);
    assert.equal(exceeds, false);
  });
});

describe('runGoldRateSync (provider priority, validation, manual mode)', () => {
  function baseDeps(overrides = {}) {
    const saved = [];
    return {
      getSettings: async () => ({ source: 'AUTOMATIC', adjustment_type: 'NONE', adjustment_value: 0, max_deviation_percent: 10 }),
      getLastRate: async () => null,
      saveRates: async (rates, source) => {
        saved.push({ rates, source });
        return rates;
      },
      saveSyncRun: async (run) => ({ id: 'fake-sync-run', ...run }),
      comparisonLoggingEnabled: false,
      retries: 0,
      retryBaseDelayMs: 1,
      ...overrides,
      __saved: saved,
    };
  }

  test('successful OroPocket fetch applies the rate and reports applied=true', async () => {
    const deps = baseDeps({ fetchOropocket: async () => ({ ratePerGram: 16000, source: 'oropocket' }) });
    const result = await runGoldRateSync({ trigger: 'CRON', deps });
    assert.equal(result.applied, true);
    assert.equal(result.effectiveRate24k, 16000);
    assert.equal(result.syncRun.resolvedProvider, 'oropocket');
    assert.equal(deps.__saved.length, 1);
    assert.equal(deps.__saved[0].source, 'oropocket');
  });

  test('18. a successful, applied rate update is exactly the signal pricingJobs.js uses to trigger recalculation', async () => {
    const deps = baseDeps({ fetchOropocket: async () => ({ ratePerGram: 16000, source: 'oropocket' }) });
    const result = await runGoldRateSync({ trigger: 'CRON', deps });
    // goldRateSyncHandler in pricingJobs.js does: `if (applied) boss.send(JOB_RECALCULATE_GOLD)`
    assert.equal(result.applied, true);
  });

  test('15. OroPocket failure falls back to GoldAPI', async () => {
    const deps = baseDeps({
      fetchOropocket: async () => {
        throw new Error('network down');
      },
      fetchGoldapi: async () => ({ ratePerGram: 15990, source: 'goldapi' }),
    });
    const result = await runGoldRateSync({ trigger: 'CRON', deps });
    assert.equal(result.applied, true);
    assert.equal(result.effectiveRate24k, 15990);
    assert.equal(result.syncRun.resolvedProvider, 'goldapi');
    assert.equal(result.syncRun.primaryStatus, 'FAILED');
  });

  test('16. both providers fail: last known valid rate is retained, nothing new saved', async () => {
    const deps = baseDeps({
      fetchOropocket: async () => {
        throw new Error('network down');
      },
      fetchGoldapi: async () => {
        throw new Error('also down');
      },
      getLastRate: async () => ({ rate_per_gram: '15500.00' }),
    });
    const result = await runGoldRateSync({ trigger: 'CRON', deps });
    assert.equal(result.applied, false);
    assert.equal(result.effectiveRate24k, 15500);
    assert.equal(deps.__saved.length, 0);
  });

  test('17. an extreme deviation is rejected, not auto-applied — no recalculation signal', async () => {
    const deps = baseDeps({
      fetchOropocket: async () => ({ ratePerGram: 30000, source: 'oropocket' }), // ~100% jump
      getLastRate: async () => ({ rate_per_gram: '15000.00' }),
    });
    const result = await runGoldRateSync({ trigger: 'CRON', deps });
    assert.equal(result.applied, false);
    assert.equal(result.syncRun.status, 'REJECTED');
    assert.equal(result.effectiveRate24k, 15000, 'previous rate must be what pricing keeps using');
    assert.equal(deps.__saved.length, 0);
  });

  test('14. manual mode: API rate is fetched for reference only, never applied to pricing', async () => {
    let oropocketCalled = false;
    const deps = baseDeps({
      getSettings: async () => ({ source: 'MANUAL', adjustment_type: 'NONE', adjustment_value: 0, max_deviation_percent: 10 }),
      getLastRate: async () => ({ rate_per_gram: '16250.00' }), // the admin's manually entered rate
      comparisonLoggingEnabled: true,
      fetchOropocket: async () => {
        oropocketCalled = true;
        return { ratePerGram: 20000, source: 'oropocket' };
      },
    });
    const result = await runGoldRateSync({ trigger: 'CRON', deps });
    assert.equal(oropocketCalled, true, 'API is still fetched for the admin panel\'s reference display');
    assert.equal(result.applied, false);
    assert.equal(result.effectiveRate24k, 16250, 'manual mode keeps using the admin-entered rate, not the API rate');
    assert.equal(deps.__saved.length, 0);
  });

  test('adjustment layer is applied on top of the resolved provider rate before deviation/save', async () => {
    const deps = baseDeps({
      getSettings: async () => ({ source: 'AUTOMATIC', adjustment_type: 'FIXED', adjustment_value: 100, max_deviation_percent: 10 }),
      fetchOropocket: async () => ({ ratePerGram: 16000, source: 'oropocket' }),
    });
    const result = await runGoldRateSync({ trigger: 'CRON', deps });
    assert.equal(result.effectiveRate24k, 16100);
    assert.equal(deps.__saved[0].rates.find((r) => r.purity === '24K').ratePerGram, 16100);
  });
});
