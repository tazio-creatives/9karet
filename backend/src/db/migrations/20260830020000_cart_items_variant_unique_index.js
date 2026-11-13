// A cart line's identity moves from the old 4-column COALESCE-normalized
// index to a single non-nullable-once-backfilled product_variant_id — this
// index is additive (old index stays until the Phase 6 cleanup migration
// drops the old columns entirely, so nothing breaks mid-cutover).
export const up = (pgm) => {
  pgm.sql('CREATE UNIQUE INDEX cart_items_variant_unique_idx ON cart_items (cart_id, product_variant_id);');
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS cart_items_variant_unique_idx;');
};
