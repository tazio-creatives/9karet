// coupons/coupon_usage, homepage_sections/homepage_items. See plan §3/§20/§36.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE coupons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENT', 'FLAT')),
      discount_value NUMERIC(12, 2) NOT NULL,
      min_order_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
      usage_limit_total INTEGER,
      usage_limit_per_user INTEGER NOT NULL DEFAULT 1,
      starts_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE TABLE coupon_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (coupon_id, order_id)
    );
  `);
  pgm.sql('CREATE INDEX coupon_usage_coupon_user_idx ON coupon_usage(coupon_id, user_id);');

  pgm.sql(`
    CREATE TABLE homepage_sections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL,
      heading TEXT,
      is_enabled BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(
    'CREATE INDEX homepage_sections_enabled_sort_idx ON homepage_sections(is_enabled, sort_order);',
  );

  pgm.sql(`
    CREATE TABLE homepage_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      section_id UUID NOT NULL REFERENCES homepage_sections(id) ON DELETE CASCADE,
      image_url TEXT,
      heading TEXT,
      cta_label TEXT,
      cta_url TEXT,
      category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
      collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
      product_id UUID REFERENCES products(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX homepage_items_section_id_idx ON homepage_items(section_id, sort_order);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS homepage_items;');
  pgm.sql('DROP TABLE IF EXISTS homepage_sections;');
  pgm.sql('DROP TABLE IF EXISTS coupon_usage;');
  pgm.sql('DROP TABLE IF EXISTS coupons;');
};
