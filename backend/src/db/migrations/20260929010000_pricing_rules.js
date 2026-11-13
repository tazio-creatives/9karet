// Pricing Rule Management, Phase 1: schema only, no admin UI to create a rule
// exists yet, so these tables stay empty and every live price is
// byte-identical until a later phase ships the admin screens.
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE pricing_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_type TEXT NOT NULL CHECK (rule_type IN ('MAKING_CHARGE','DIAMOND')),
      name TEXT NOT NULL,
      scope TEXT NOT NULL CHECK (scope IN ('GLOBAL','CATEGORY','PRODUCT')),
      discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENT','FIXED_AMOUNT','FIXED_AMOUNT_PER_CARAT')),
      discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value >= 0),
      purity_scope TEXT NOT NULL DEFAULT 'ALL' CHECK (purity_scope IN ('ALL','SELECTED')),
      -- Only meaningful for scope IN ('CATEGORY','GLOBAL') — a PRODUCT-scope
      -- rule always outranks everything else (resolution tier #1) regardless
      -- of this value. PRESERVE (default): this rule never reaches a product
      -- that already has its own product_purity_pricing_rules override or
      -- flat discount column set (tiers #2/#3). SUPPRESS: while this rule is
      -- live (per isLive()), those tiers are treated as absent for products
      -- in its scope, so this rule's own discount applies instead — the
      -- instant the rule stops being live (expires/disabled/deleted), those
      -- tiers resolve again automatically, since SUPPRESS never writes to
      -- product_purity_pricing_rules or the flat column.
      override_mode TEXT NOT NULL DEFAULT 'PRESERVE' CHECK (override_mode IN ('PRESERVE','SUPPRESS')),
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SCHEDULED','ACTIVE','EXPIRED','DISABLED')),
      priority INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT pricing_rules_window_chk CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
      CONSTRAINT pricing_rules_percent_chk CHECK (discount_type <> 'PERCENT' OR discount_value <= 100),
      CONSTRAINT pricing_rules_making_type_chk CHECK (rule_type <> 'MAKING_CHARGE' OR discount_type IN ('PERCENT','FIXED_AMOUNT'))
    );
  `);
  pgm.sql(`CREATE INDEX pricing_rules_live_idx ON pricing_rules(rule_type, scope) WHERE status IN ('ACTIVE','SCHEDULED');`);
  pgm.sql(`CREATE INDEX pricing_rules_window_idx ON pricing_rules(starts_at, ends_at) WHERE status IN ('SCHEDULED','ACTIVE');`);

  pgm.sql(`
    CREATE TABLE pricing_rule_categories (
      rule_id UUID NOT NULL REFERENCES pricing_rules(id) ON DELETE CASCADE,
      category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      PRIMARY KEY (rule_id, category_id)
    );
  `);
  pgm.sql(`CREATE INDEX pricing_rule_categories_category_id_idx ON pricing_rule_categories(category_id);`);

  pgm.sql(`
    CREATE TABLE pricing_rule_products (
      rule_id UUID NOT NULL REFERENCES pricing_rules(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      PRIMARY KEY (rule_id, product_id)
    );
  `);
  pgm.sql(`CREATE INDEX pricing_rule_products_product_id_idx ON pricing_rule_products(product_id);`);

  pgm.sql(`
    CREATE TABLE pricing_rule_diamond_types (
      rule_id UUID NOT NULL REFERENCES pricing_rules(id) ON DELETE CASCADE,
      diamond_type_id UUID NOT NULL REFERENCES diamond_types(id) ON DELETE RESTRICT,
      PRIMARY KEY (rule_id, diamond_type_id)
    );
  `);
  pgm.sql(`CREATE INDEX pricing_rule_diamond_types_type_idx ON pricing_rule_diamond_types(diamond_type_id);`);

  // Same purity_value_id FK as product_purity_pricing_rules, so "configured
  // purities" means the same attribute-value set in both mechanisms.
  pgm.sql(`
    CREATE TABLE pricing_rule_purities (
      rule_id UUID NOT NULL REFERENCES pricing_rules(id) ON DELETE CASCADE,
      purity_value_id UUID NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
      PRIMARY KEY (rule_id, purity_value_id)
    );
  `);

  // DIAMOND_SHAPE deliberately excluded (deferred — no products.diamond_shape
  // column exists anywhere in the schema yet).
  pgm.sql(`
    CREATE TABLE pricing_rule_conditions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID NOT NULL REFERENCES pricing_rules(id) ON DELETE CASCADE,
      condition_type TEXT NOT NULL CHECK (condition_type IN ('DIAMOND_QUALITY','DIAMOND_COLOUR','DIAMOND_CLARITY','CARAT_RANGE')),
      string_values TEXT[],
      min_value NUMERIC(10,3),
      max_value NUMERIC(10,3),
      UNIQUE (rule_id, condition_type)
    );
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS pricing_rule_conditions;');
  pgm.sql('DROP TABLE IF EXISTS pricing_rule_purities;');
  pgm.sql('DROP TABLE IF EXISTS pricing_rule_diamond_types;');
  pgm.sql('DROP TABLE IF EXISTS pricing_rule_products;');
  pgm.sql('DROP TABLE IF EXISTS pricing_rule_categories;');
  pgm.sql('DROP TABLE IF EXISTS pricing_rules;');
};
