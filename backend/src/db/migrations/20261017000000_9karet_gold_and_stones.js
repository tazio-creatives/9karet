// 9Karet: 9K gold only, gemstones instead of diamonds.
//
// The platform was forked from BOX Diamonds, whose catalogue priced diamonds
// from quality tiers (diamond_configs, rate per cent) on top of 9K-24K gold
// or platinum. 9Karet sells 9K gold only, set with coloured stones / gems
// whose weight and price are entered by hand per product. This migration
// reshapes the schema for that:
//
//   - products: metal is always GOLD, purity always 9K.
//   - stone_types (was diamond_types): admin-managed master list (Ruby,
//     Emerald, CZ, ...) a product's stones are picked from.
//   - product_stones: 0..N stone lines per product — type, count, weight in
//     carats and a fixed price. stone_value is the sum of those prices; it
//     doesn't move with the gold rate.
//   - every diamond_* column/table is dropped or renamed to its stone_*
//     equivalent (discount %, effective rule cache, order line value).
//   - pricing_rules: rule_type DIAMOND -> STONE, scoped by stone type and an
//     optional carat range (diamond quality/colour/clarity conditions go).
//
// Written for a fresh database; on one with real diamond data the
// diamond_quality attribute delete below fails on its RESTRICT FK, which is
// the intended stop.

export const up = (pgm) => {
  // --- Legacy pre-variant-model leftovers that reference diamond_configs ---
  pgm.sql('DROP INDEX IF EXISTS cart_items_line_unique_idx;');
  pgm.sql('ALTER TABLE cart_items DROP COLUMN IF EXISTS diamond_config_id;');
  pgm.sql('ALTER TABLE order_items DROP COLUMN IF EXISTS diamond_config_id;');
  pgm.sql('ALTER TABLE order_items DROP COLUMN IF EXISTS diamond_config_name;');
  pgm.sql('DROP TABLE IF EXISTS product_diamond_options;');

  // --- Diamond Quality variant axis ---
  pgm.sql(`DELETE FROM attributes WHERE code = 'diamond_quality';`);

  // --- products ---
  pgm.sql(`
    ALTER TABLE products
      DROP COLUMN diamond_config_id,
      DROP COLUMN diamond_type_id,
      DROP COLUMN diamond_type,
      DROP COLUMN diamond_colour,
      DROP COLUMN diamond_clarity,
      DROP COLUMN diamond_count,
      DROP COLUMN diamond_weight_grams,
      DROP COLUMN diamond_value_is_manual,
      DROP COLUMN gemstone;
  `);
  pgm.sql('ALTER TABLE products RENAME COLUMN diamond_weight_carats TO stone_weight_carats;');
  pgm.sql('ALTER TABLE products RENAME COLUMN diamond_value TO stone_value;');
  pgm.sql('ALTER TABLE products RENAME COLUMN diamond_discount_percent TO stone_discount_percent;');
  pgm.sql(
    'ALTER TABLE products RENAME COLUMN effective_diamond_discount_percent TO effective_stone_discount_percent;',
  );
  pgm.sql(
    'ALTER TABLE products RENAME COLUMN effective_diamond_discount_amount TO effective_stone_discount_amount;',
  );
  pgm.sql('ALTER TABLE products RENAME COLUMN effective_diamond_rule_id TO effective_stone_rule_id;');
  pgm.sql('ALTER TABLE products RENAME COLUMN effective_diamond_breakdown TO effective_stone_breakdown;');

  pgm.sql(`UPDATE products SET metal_type = 'GOLD', purity = '9K';`);
  pgm.sql('ALTER TABLE products DROP CONSTRAINT products_metal_type_check;');
  pgm.sql(`ALTER TABLE products ADD CONSTRAINT products_metal_type_check CHECK (metal_type = 'GOLD');`);
  pgm.sql(`ALTER TABLE products ALTER COLUMN metal_type SET DEFAULT 'GOLD';`);
  pgm.sql('ALTER TABLE products DROP CONSTRAINT products_purity_check;');
  pgm.sql(`ALTER TABLE products ADD CONSTRAINT products_purity_check CHECK (purity = '9K');`);
  pgm.sql(`ALTER TABLE products ALTER COLUMN purity SET DEFAULT '9K';`);

  // --- variants / sizes: stones are product-level, never per-variant ---
  pgm.sql(`
    ALTER TABLE product_variants
      DROP COLUMN diamond_weight_grams,
      DROP COLUMN diamond_weight_carats;
  `);
  pgm.sql('ALTER TABLE product_sizes DROP COLUMN IF EXISTS diamond_weight_carats;');

  // --- product_purity_pricing_rules ---
  pgm.sql(
    'ALTER TABLE product_purity_pricing_rules RENAME COLUMN diamond_discount_percent TO stone_discount_percent;',
  );

  // --- order_items: stone value + what stones the piece was sold with ---
  pgm.sql('ALTER TABLE order_items RENAME COLUMN diamond_value TO stone_value;');
  pgm.sql(`
    ALTER TABLE order_items
      DROP COLUMN diamond_weight_carats_snapshot,
      DROP COLUMN diamond_count_snapshot,
      DROP COLUMN diamond_colour_snapshot,
      DROP COLUMN diamond_clarity_snapshot,
      ADD COLUMN stones_snapshot JSONB;
  `);

  // --- stone_types (was diamond_types) ---
  pgm.sql('ALTER TABLE diamond_types RENAME TO stone_types;');
  pgm.sql('ALTER INDEX diamond_types_pkey RENAME TO stone_types_pkey;');
  pgm.sql('ALTER INDEX diamond_types_slug_key RENAME TO stone_types_slug_key;');

  // --- product_stones ---
  pgm.sql(`
    CREATE TABLE product_stones (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      stone_type_id UUID NOT NULL REFERENCES stone_types(id) ON DELETE RESTRICT,
      stone_count INTEGER NOT NULL DEFAULT 1 CHECK (stone_count > 0),
      weight_carats NUMERIC(10, 3) NOT NULL CHECK (weight_carats > 0),
      price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX product_stones_product_id_idx ON product_stones(product_id, sort_order);');
  pgm.sql('CREATE INDEX product_stones_stone_type_id_idx ON product_stones(stone_type_id);');

  // --- pricing rules: DIAMOND -> STONE ---
  pgm.sql('ALTER TABLE pricing_rules DROP CONSTRAINT pricing_rules_rule_type_check;');
  pgm.sql(`UPDATE pricing_rules SET rule_type = 'STONE' WHERE rule_type = 'DIAMOND';`);
  pgm.sql(
    `ALTER TABLE pricing_rules ADD CONSTRAINT pricing_rules_rule_type_check CHECK (rule_type IN ('MAKING_CHARGE','STONE'));`,
  );

  pgm.sql('ALTER TABLE pricing_rule_diamond_types RENAME TO pricing_rule_stone_types;');
  pgm.sql('ALTER TABLE pricing_rule_stone_types RENAME COLUMN diamond_type_id TO stone_type_id;');
  pgm.sql('ALTER INDEX pricing_rule_diamond_types_type_idx RENAME TO pricing_rule_stone_types_type_idx;');

  pgm.sql(`DELETE FROM pricing_rule_conditions WHERE condition_type <> 'CARAT_RANGE';`);
  pgm.sql('ALTER TABLE pricing_rule_conditions DROP CONSTRAINT pricing_rule_conditions_condition_type_check;');
  pgm.sql(
    `ALTER TABLE pricing_rule_conditions ADD CONSTRAINT pricing_rule_conditions_condition_type_check CHECK (condition_type IN ('CARAT_RANGE'));`,
  );

  // --- retired diamond pricing tables ---
  pgm.sql('DROP TABLE IF EXISTS diamond_configs;');
  pgm.sql('DROP TABLE IF EXISTS diamond_rates;');

  // --- reference data a fresh 9Karet database needs ---
  pgm.sql(`
    INSERT INTO attribute_values (attribute_id, value, label, sort_order)
    SELECT id, '9K', '9K', 0 FROM attributes WHERE code = 'purity'
    ON CONFLICT (attribute_id, value) WHERE product_id IS NULL DO NOTHING;
  `);
  pgm.sql(`
    INSERT INTO attribute_values (attribute_id, value, label, sort_order)
    SELECT a.id, v.value, v.label, v.sort_order
    FROM attributes a,
      (VALUES ('YELLOW', 'Yellow Gold', 0), ('ROSE', 'Rose Gold', 1), ('WHITE', 'White Gold', 2))
        AS v(value, label, sort_order)
    WHERE a.code = 'gold_color'
    ON CONFLICT (attribute_id, value) WHERE product_id IS NULL DO NOTHING;
  `);
  pgm.sql(`
    INSERT INTO stone_types (name, slug, sort_order) VALUES
      ('Ruby', 'ruby', 0),
      ('Emerald', 'emerald', 1),
      ('Sapphire', 'sapphire', 2),
      ('Cubic Zirconia', 'cubic-zirconia', 3),
      ('Pearl', 'pearl', 4)
    ON CONFLICT (slug) DO NOTHING;
  `);
};

// One-way: the diamond schema it replaces isn't coming back on 9Karet.
export const down = false;
