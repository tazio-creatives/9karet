// Diamond quality tier rates move from "per carat" to "per cent" (1 carat =
// 100 cents), matching the product Diamond Weight field's existing cents
// convention (see 20260815030000-adjacent ProductFormPage change) — an
// admin no longer has to mentally convert between the two. Purely a
// data/label change: every existing rate is divided by 100 here, and
// computeDiamondValue (pricingService.js) is updated in the same deploy to
// multiply by carats*100 instead of carats — the actual ₹ charged for any
// given stone is unchanged, only the per-unit number an admin types/reads
// is smaller and now matches the weight unit. The rate_per_carat DB column
// itself keeps its name (internal detail); only the value and the
// application-layer field name (ratePerCarat -> ratePerCent) change.

export const up = (pgm) => {
  pgm.sql('UPDATE diamond_configs SET rate_per_carat = rate_per_carat / 100;');
};

export const down = (pgm) => {
  pgm.sql('UPDATE diamond_configs SET rate_per_carat = rate_per_carat * 100;');
};
