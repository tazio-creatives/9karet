// Lets a product override the storefront/admin wording for its "Size" axis
// (e.g. "Length" for a chain/necklace, instead of a ring size) without
// building out a genuinely separate variation axis — the Size mechanism
// itself (per-product free-text values, its own stock/weight lifecycle,
// storefront selector) already works for any kind of measurement; this only
// changes what it's *called*, and lets the storefront skip the ring-specific
// Size Guide chart when it isn't actually a ring size. NULL (the default for
// every existing product) means "Size", unchanged from today.
export const up = (pgm) => {
  pgm.sql('ALTER TABLE products ADD COLUMN size_label TEXT NULL;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE products DROP COLUMN IF EXISTS size_label;');
};
