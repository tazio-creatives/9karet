// An optional fixed final price for one exact combination — set, it wins
// outright over the normal live gold-rate/purity/weight computation for
// that variant (computeVariantPricing short-circuits to it). NULL (the
// overwhelming common case) means "keep pricing this the normal way."
export const up = (pgm) => {
  pgm.sql('ALTER TABLE product_variants ADD COLUMN price_override NUMERIC(12, 2);');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE product_variants DROP COLUMN IF EXISTS price_override;');
};
