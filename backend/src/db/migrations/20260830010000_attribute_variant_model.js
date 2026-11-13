// Replaces the flat product-variation model (product_gold_colors /
// product_purity_options / product_diamond_options as pure "what's offered"
// lists, no per-combination validity/weight/price/stock) with a standard
// attribute + variant model: attributes/attribute_values are admin-defined
// dimensions and their options, product_variants is one row per REAL
// sellable combination for a product, each with its own optional weight
// overrides, its own stock, and an availability flag.
//
// Additive only — old tables/columns are untouched here. A data-migration
// script (backend/scripts/migrateProductVariants.js) populates the new
// tables from the old ones; a later cleanup migration drops the old tables
// once that migration's output has been verified.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE attributes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // product_id NULL = a shared/global value offered to any product (Purity,
  // Gold Color, Diamond Quality). product_id NOT NULL = a product-scoped
  // custom value (Size — preserves today's free-text-per-product labels
  // instead of forcing every ring size ever typed into one shared catalog).
  // ref_id is a generic escape hatch for an attribute whose values wrap
  // another first-class entity — Diamond Quality values point at
  // diamond_configs.id here instead of duplicating name/rate.
  pgm.sql(`
    CREATE TABLE attribute_values (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      ref_id UUID,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX attribute_values_global_unique_idx
      ON attribute_values(attribute_id, value) WHERE product_id IS NULL;
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX attribute_values_scoped_unique_idx
      ON attribute_values(attribute_id, product_id, value) WHERE product_id IS NOT NULL;
  `);
  pgm.sql('CREATE INDEX attribute_values_attribute_id_idx ON attribute_values(attribute_id);');
  pgm.sql('CREATE INDEX attribute_values_product_id_idx ON attribute_values(product_id) WHERE product_id IS NOT NULL;');

  // "What this product offers on each axis" — the generalized replacement
  // for product_gold_colors/product_purity_options/product_diamond_options.
  pgm.sql(`
    CREATE TABLE product_attribute_values (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      attribute_value_id UUID NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (product_id, attribute_value_id)
    );
  `);
  pgm.sql('CREATE INDEX product_attribute_values_product_id_idx ON product_attribute_values(product_id);');

  // One row per real sellable combination. NULL weight columns = inherit
  // the product's own base value (products.gold_weight_grams etc.);
  // non-null = this exact combination is cast at a different weight — this
  // is what lets Gold Color (or any attribute) affect price if the admin
  // chooses to enter a differing weight for it, without forcing it to.
  //
  // Every product gets at least one variant row, even with zero configured
  // attributes (a synthetic default variant, no variant_attribute_values
  // rows) — this is what lets cart/order/stock key on one non-nullable
  // product_variant_id instead of branching on "does this product have
  // sizes/colors configured" the way today's code does everywhere.
  pgm.sql(`
    CREATE TABLE product_variants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      sku TEXT,
      is_available BOOLEAN NOT NULL DEFAULT true,
      gold_weight_grams NUMERIC(10, 3),
      diamond_weight_grams NUMERIC(10, 3),
      diamond_weight_carats NUMERIC(10, 3),
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      combination_key TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (product_id, combination_key)
    );
  `);
  pgm.sql('CREATE INDEX product_variants_product_id_idx ON product_variants(product_id, sort_order);');

  // ON DELETE RESTRICT on attribute_value_id: an admin must deactivate a
  // value in use (is_active=false), not delete it out from under a real
  // variant — same reasoning as diamond_configs' existing RESTRICT from
  // products.diamond_config_id.
  pgm.sql(`
    CREATE TABLE variant_attribute_values (
      variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      attribute_value_id UUID NOT NULL REFERENCES attribute_values(id) ON DELETE RESTRICT,
      PRIMARY KEY (variant_id, attribute_value_id)
    );
  `);
  pgm.sql('CREATE INDEX variant_attribute_values_attribute_value_id_idx ON variant_attribute_values(attribute_value_id);');

  // Additive FK columns on the existing cart/order/reservation tables —
  // nullable for now, backfilled by the data migration script, made
  // NOT NULL (cart_items/stock_reservations) in the later cleanup
  // migration once verified. order_items.product_variant_id stays
  // nullable permanently (ON DELETE SET NULL) — the JSONB snapshot below,
  // not this FK, is the historical source of truth for what an order shows.
  pgm.sql('ALTER TABLE cart_items ADD COLUMN product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;');
  pgm.sql('ALTER TABLE order_items ADD COLUMN product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;');
  // Replaces the old fixed snapshot columns (gold_color/purity/
  // diamond_config_id+name/product_size_label) with an attribute-count-
  // agnostic list: [{attributeCode, label}] — captured once at order
  // placement, never recalculated, survives a later attribute-value
  // rename/deactivation exactly like the old flat snapshot columns did.
  pgm.sql('ALTER TABLE order_items ADD COLUMN variant_attributes_snapshot JSONB;');
  pgm.sql('ALTER TABLE stock_reservations ADD COLUMN product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;');

  // Seed the 4 known attributes so the app has something to render/attach
  // to immediately — values are populated by the data migration script.
  pgm.sql(`
    INSERT INTO attributes (code, name, sort_order) VALUES
      ('purity', 'Purity', 0),
      ('gold_color', 'Gold Color', 1),
      ('diamond_quality', 'Diamond Quality', 2),
      ('size', 'Size', 3);
  `);
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE stock_reservations DROP COLUMN IF EXISTS product_variant_id;');
  pgm.sql('ALTER TABLE order_items DROP COLUMN IF EXISTS variant_attributes_snapshot;');
  pgm.sql('ALTER TABLE order_items DROP COLUMN IF EXISTS product_variant_id;');
  pgm.sql('ALTER TABLE cart_items DROP COLUMN IF EXISTS product_variant_id;');

  pgm.sql('DROP TABLE IF EXISTS variant_attribute_values;');
  pgm.sql('DROP TABLE IF EXISTS product_variants;');
  pgm.sql('DROP TABLE IF EXISTS product_attribute_values;');
  pgm.sql('DROP TABLE IF EXISTS attribute_values;');
  pgm.sql('DROP TABLE IF EXISTS attributes;');
};
