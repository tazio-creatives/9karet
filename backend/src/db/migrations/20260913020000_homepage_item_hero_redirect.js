// Adds the simplified Hero Slider redirect model to homepage_items. These
// columns are additive and only ever populated by the Hero Banner admin form
// (HERO section type) — every other section type's items keep defaulting to
// redirect_type='NONE'/is_enabled=true, which is a no-op for their existing
// behaviour.
export const up = (pgm) => {
  pgm.sql(`ALTER TABLE homepage_items ADD COLUMN name TEXT;`);
  pgm.sql(`
    ALTER TABLE homepage_items ADD COLUMN redirect_type TEXT NOT NULL DEFAULT 'NONE'
      CHECK (redirect_type IN ('NONE', 'CATEGORY', 'COLLECTION', 'PRODUCT'));
  `);
  pgm.sql(`ALTER TABLE homepage_items ADD COLUMN open_in_new_tab BOOLEAN NOT NULL DEFAULT false;`);
  pgm.sql(`ALTER TABLE homepage_items ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT true;`);

  // Backfill existing HERO items only — infer redirect_type from whichever
  // destination id they already had set (CTA URL, if any, has no equivalent
  // in the new model and is simply dropped for these rows).
  pgm.sql(`
    UPDATE homepage_items hi SET redirect_type = 'CATEGORY'
    FROM homepage_sections hs
    WHERE hi.section_id = hs.id AND hs.type = 'HERO' AND hi.category_id IS NOT NULL;
  `);
  pgm.sql(`
    UPDATE homepage_items hi SET redirect_type = 'COLLECTION'
    FROM homepage_sections hs
    WHERE hi.section_id = hs.id AND hs.type = 'HERO' AND hi.collection_id IS NOT NULL AND hi.redirect_type = 'NONE';
  `);
  pgm.sql(`
    UPDATE homepage_items hi SET redirect_type = 'PRODUCT'
    FROM homepage_sections hs
    WHERE hi.section_id = hs.id AND hs.type = 'HERO' AND hi.product_id IS NOT NULL AND hi.redirect_type = 'NONE';
  `);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE homepage_items DROP COLUMN IF EXISTS name;`);
  pgm.sql(`ALTER TABLE homepage_items DROP COLUMN IF EXISTS redirect_type;`);
  pgm.sql(`ALTER TABLE homepage_items DROP COLUMN IF EXISTS open_in_new_tab;`);
  pgm.sql(`ALTER TABLE homepage_items DROP COLUMN IF EXISTS is_enabled;`);
};
