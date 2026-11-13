// Per-size diamond weight override, alongside the existing per-size gold
// weight override — a bigger size can carry more diamond weight too (e.g.
// more stones around a bigger band), not just more gold.

export const up = (pgm) => {
  pgm.addColumn('product_sizes', {
    diamond_weight_carats: { type: 'NUMERIC(10,3)' },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('product_sizes', ['diamond_weight_carats']);
};
