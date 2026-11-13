// Real product size variants (replaces the old free-text products.product_size
// as a source of a selectable "Select Size" dropdown) — each product may have
// zero or more admin-configured sizes, each with its own stock. Products with
// no configured sizes behave exactly as before (no dropdown, product-level
// stock_quantity still authoritative).

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE product_sizes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (product_id, label)
    );
  `);
  pgm.sql('CREATE INDEX product_sizes_product_id_idx ON product_sizes(product_id, sort_order);');

  // cart_items: nullable size FK + partial-unique replacement for the old
  // plain UNIQUE(cart_id, product_id) — Postgres treats each NULL as
  // distinct, so a plain UNIQUE including a nullable column would let
  // duplicate sizeless rows through. Two partial indexes (same pattern as
  // carts_user_id_unique_idx in 20260810010500_commerce.js) fix that.
  pgm.sql('ALTER TABLE cart_items ADD COLUMN product_size_id UUID REFERENCES product_sizes(id) ON DELETE CASCADE;');
  pgm.sql('ALTER TABLE cart_items DROP CONSTRAINT cart_items_cart_id_product_id_key;');
  pgm.sql(
    'CREATE UNIQUE INDEX cart_items_no_size_unique_idx ON cart_items(cart_id, product_id) WHERE product_size_id IS NULL;',
  );
  pgm.sql(
    'CREATE UNIQUE INDEX cart_items_with_size_unique_idx ON cart_items(cart_id, product_id, product_size_id) WHERE product_size_id IS NOT NULL;',
  );

  pgm.sql(
    'ALTER TABLE stock_reservations ADD COLUMN product_size_id UUID REFERENCES product_sizes(id) ON DELETE CASCADE;',
  );

  // order_items keeps a label snapshot (same convention as product_name/
  // product_sku) so order history survives the size row later being renamed
  // or removed.
  pgm.sql(
    'ALTER TABLE order_items ADD COLUMN product_size_id UUID REFERENCES product_sizes(id) ON DELETE SET NULL;',
  );
  pgm.sql('ALTER TABLE order_items ADD COLUMN product_size_label TEXT;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE order_items DROP COLUMN IF EXISTS product_size_label;');
  pgm.sql('ALTER TABLE order_items DROP COLUMN IF EXISTS product_size_id;');
  pgm.sql('ALTER TABLE stock_reservations DROP COLUMN IF EXISTS product_size_id;');
  pgm.sql('DROP INDEX IF EXISTS cart_items_with_size_unique_idx;');
  pgm.sql('DROP INDEX IF EXISTS cart_items_no_size_unique_idx;');
  pgm.sql('ALTER TABLE cart_items ADD CONSTRAINT cart_items_cart_id_product_id_key UNIQUE (cart_id, product_id);');
  pgm.sql('ALTER TABLE cart_items DROP COLUMN IF EXISTS product_size_id;');
  pgm.sql('DROP TABLE IF EXISTS product_sizes;');
};
