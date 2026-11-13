// Splits the single net_weight_grams input into two admin-entered figures —
// gold_weight_grams (metal only, drives gold pricing) and diamond_weight_grams
// (new, additive-only, never priced) — with net_weight_grams becoming a
// derived total (gold + diamond) computed server-side (productsService.js).
// Backfill sets gold_weight_grams = the existing net_weight_grams so every
// current product's gold pricing is unchanged until it's next edited.

export const up = async (pgm) => {
  pgm.addColumn('products', {
    gold_weight_grams: { type: 'NUMERIC(10,3)' },
    diamond_weight_grams: { type: 'NUMERIC(10,3)' },
  });
  pgm.sql(`UPDATE products SET gold_weight_grams = net_weight_grams WHERE net_weight_grams IS NOT NULL`);
};

export const down = (pgm) => {
  pgm.dropColumn('products', ['gold_weight_grams', 'diamond_weight_grams']);
};
