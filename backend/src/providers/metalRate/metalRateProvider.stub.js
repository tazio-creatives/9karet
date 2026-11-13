// Dev/test provider — returns a plausible 24K INR/gram rate with small
// jitter so repeated syncs actually move the number, without calling a real
// feed. Swap for a real provider (goldapi.io, MetalpriceAPI, etc.) later.
const BASE_RATE_24K = 7400;

export const stubMetalRateProvider = {
  async fetchRate(metal) {
    if (metal !== 'GOLD') {
      throw new Error(`stub metal rate provider only supports GOLD, got "${metal}"`);
    }
    const jitter = (Math.random() - 0.5) * 40; // +/- 20
    const ratePerGram = Math.round((BASE_RATE_24K + jitter) * 100) / 100;
    return { ratePerGram, source: 'stub' };
  },
};
