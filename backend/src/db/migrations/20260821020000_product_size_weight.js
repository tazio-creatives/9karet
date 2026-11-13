// Optional per-size weight override — a bigger ring size uses more gold and
// should price differently, but every size shares the product's single
// net_weight_grams today. NULL means "use the product's own weight" (fully
// backward compatible with every existing size row).

export const up = (pgm) => {
  pgm.sql('ALTER TABLE product_sizes ADD COLUMN weight_grams NUMERIC(10, 3);');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE product_sizes DROP COLUMN IF EXISTS weight_grams;');
};
