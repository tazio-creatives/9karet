// Customer-selectable pricing variations — Gold Color, Purity, and Diamond
// Quality. Unlike product_sizes (own stock pool), these three don't gate
// stock: picking a different purity/diamond tier changes the computed price
// (via the existing gold-rate/diamond-config pricing engine) but not
// availability. A product with none of these configured behaves exactly as
// before (no selector shown, base purity/goldColor/diamondConfigId used).
//
// The option tables are pure "what's offered" lists (no independent
// identity that cart/order rows need to reference) — cart_items/order_items
// store the raw selected value directly, so a product edit can safely
// delete-and-reinsert the option rows without orphaning anything.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE product_gold_colors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE (product_id, color)
    );
  `);

  pgm.sql(`
    CREATE TABLE product_purity_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      purity TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE (product_id, purity)
    );
  `);

  pgm.sql(`
    CREATE TABLE product_diamond_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      diamond_config_id UUID NOT NULL REFERENCES diamond_configs(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE (product_id, diamond_config_id)
    );
  `);

  // cart_items: three nullable selection columns. The old two-partial-index
  // approach (one per sizeId nullability) doesn't scale to four independent
  // nullable axes — a COALESCE-normalized single unique index treats every
  // "unset" axis as the same empty-string value, so two fully-default lines
  // still collide as duplicates while any differing axis is treated as a
  // distinct line, with one index instead of a combinatorial set of them.
  pgm.sql('ALTER TABLE cart_items ADD COLUMN gold_color TEXT NULL;');
  pgm.sql('ALTER TABLE cart_items ADD COLUMN purity TEXT NULL;');
  pgm.sql(
    'ALTER TABLE cart_items ADD COLUMN diamond_config_id UUID NULL REFERENCES diamond_configs(id) ON DELETE RESTRICT;',
  );
  pgm.sql('DROP INDEX IF EXISTS cart_items_with_size_unique_idx;');
  pgm.sql('DROP INDEX IF EXISTS cart_items_no_size_unique_idx;');
  pgm.sql(`
    CREATE UNIQUE INDEX cart_items_line_unique_idx ON cart_items (
      cart_id, product_id,
      COALESCE(product_size_id::text, ''),
      COALESCE(gold_color, ''),
      COALESCE(purity, ''),
      COALESCE(diamond_config_id::text, '')
    );
  `);

  // order_items: numeric price snapshot columns already exist (gold_value/
  // diamond_value/etc.) — these just add which selection produced them, for
  // display/reorder, following the same snapshot convention as
  // product_size_label (survives the diamond_config row later being renamed).
  pgm.sql('ALTER TABLE order_items ADD COLUMN gold_color TEXT NULL;');
  pgm.sql('ALTER TABLE order_items ADD COLUMN purity TEXT NULL;');
  pgm.sql(
    'ALTER TABLE order_items ADD COLUMN diamond_config_id UUID NULL REFERENCES diamond_configs(id) ON DELETE SET NULL;',
  );
  pgm.sql('ALTER TABLE order_items ADD COLUMN diamond_config_name TEXT NULL;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE order_items DROP COLUMN IF EXISTS diamond_config_name;');
  pgm.sql('ALTER TABLE order_items DROP COLUMN IF EXISTS diamond_config_id;');
  pgm.sql('ALTER TABLE order_items DROP COLUMN IF EXISTS purity;');
  pgm.sql('ALTER TABLE order_items DROP COLUMN IF EXISTS gold_color;');

  pgm.sql('DROP INDEX IF EXISTS cart_items_line_unique_idx;');
  pgm.sql(
    'CREATE UNIQUE INDEX cart_items_no_size_unique_idx ON cart_items(cart_id, product_id) WHERE product_size_id IS NULL;',
  );
  pgm.sql(
    'CREATE UNIQUE INDEX cart_items_with_size_unique_idx ON cart_items(cart_id, product_id, product_size_id) WHERE product_size_id IS NOT NULL;',
  );
  pgm.sql('ALTER TABLE cart_items DROP COLUMN IF EXISTS diamond_config_id;');
  pgm.sql('ALTER TABLE cart_items DROP COLUMN IF EXISTS purity;');
  pgm.sql('ALTER TABLE cart_items DROP COLUMN IF EXISTS gold_color;');

  pgm.sql('DROP TABLE IF EXISTS product_diamond_options;');
  pgm.sql('DROP TABLE IF EXISTS product_purity_options;');
  pgm.sql('DROP TABLE IF EXISTS product_gold_colors;');
};
