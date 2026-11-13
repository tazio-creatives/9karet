// categories (hierarchical via parent_id — corrected per 2026-08-10), collections,
// products (all jewellery attributes + pricing fields + status), product_categories
// (many-to-many), product_images. See plan §3/§7/§31.
//
// Implementation note (filling a gap the plan didn't spell out, not a redesign):
// products.category_id is the single canonical category used for the SEO URL
// (/:categorySlug/:productSlug) and admin "Category"/"Subcategory" fields (a
// subcategory IS a category row with a parent_id). product_categories is kept
// for secondary/cross-listing tags (e.g. a ring also shown under "Gifts")
// with an is_primary flag available if that ever needs to diverge from
// products.category_id.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX categories_parent_id_idx ON categories(parent_id);');

  pgm.sql(`
    CREATE TABLE collections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE TABLE products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      -- basic info
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
      collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
      short_description TEXT,
      full_description TEXT,

      -- jewellery details (plan §7)
      metal_type TEXT NOT NULL CHECK (metal_type IN ('GOLD', 'PLATINUM')),
      purity TEXT CHECK (purity IN ('14K', '18K', '22K', '24K')),
      gross_weight_grams NUMERIC(10, 3),
      net_weight_grams NUMERIC(10, 3),
      diamond_weight_carats NUMERIC(10, 3),
      diamond_count INTEGER,
      diamond_type TEXT,
      diamond_colour TEXT,
      diamond_clarity TEXT,
      gemstone TEXT,
      certification TEXT,
      product_size TEXT,
      care_instructions TEXT,

      -- pricing (plan §9a)
      gold_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
      diamond_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
      diamond_value_is_manual BOOLEAN NOT NULL DEFAULT false,
      making_charge NUMERIC(12, 2) NOT NULL DEFAULT 0,
      gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 3.00,
      mrp NUMERIC(12, 2) NOT NULL DEFAULT 0,
      selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      is_price_locked BOOLEAN NOT NULL DEFAULT false,

      -- inventory & lifecycle
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'AI_PROCESSING', 'AI_READY', 'PUBLISHED', 'FAILED')),

      -- SEO (plan §40)
      slug TEXT NOT NULL UNIQUE,
      meta_title TEXT,
      meta_description TEXT,
      meta_keywords TEXT,

      -- denormalized reviews aggregate (plan §3 Reviews / §11a)
      rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,

      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(
    'CREATE INDEX products_category_status_created_idx ON products(category_id, status, created_at);',
  );
  pgm.sql('CREATE INDEX products_collection_id_idx ON products(collection_id);');
  pgm.sql('CREATE INDEX products_status_idx ON products(status);');

  pgm.sql(`
    CREATE TABLE product_categories (
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      PRIMARY KEY (product_id, category_id)
    );
  `);
  pgm.sql('CREATE INDEX product_categories_category_id_idx ON product_categories(category_id);');

  pgm.sql(`
    CREATE TABLE product_images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('ORIGINAL', 'AI_GENERATED')),
      variant TEXT NOT NULL CHECK (variant IN ('thumbnail', 'small', 'medium', 'large', 'original')),
      format TEXT NOT NULL CHECK (format IN ('avif', 'webp', 'jpeg')),
      url TEXT NOT NULL,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX product_images_product_id_idx ON product_images(product_id, sort_order);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS product_images;');
  pgm.sql('DROP TABLE IF EXISTS product_categories;');
  pgm.sql('DROP TABLE IF EXISTS products;');
  pgm.sql('DROP TABLE IF EXISTS collections;');
  pgm.sql('DROP TABLE IF EXISTS categories;');
};
