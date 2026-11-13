// Tracks the single currently-active generated Product Size Image per
// product, decoupled from the AI Studio job/asset state machine (that
// pipeline's tables are untouched by this feature entirely — Product Size
// Image is its own generation flow, see productSizeImageService.js /
// productSizeImageJob.js). image_sort_order points at the product_images
// group (9 rows: 4 variants x 2 formats + 1 original) holding the actual
// files, inserted the same way every other AI-generated photo is.
//
// The partial unique index is what makes "at most one active Product Size
// Image per product" a real, DB-enforced invariant rather than an app-level
// convention — the PDP gallery reorder logic (web/src/pages/PDPPage.tsx)
// depends on this being true.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE product_size_generated_images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      measurement_version INTEGER NOT NULL,
      image_sort_order INTEGER,
      status TEXT NOT NULL DEFAULT 'generating'
        CHECK (status IN ('generating', 'passed', 'warning', 'failed', 'stale')),
      failure_reason TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX product_size_generated_images_one_active
      ON product_size_generated_images (product_id) WHERE is_active = true;
  `);
  pgm.sql(`
    CREATE INDEX product_size_generated_images_product_id_idx
      ON product_size_generated_images (product_id);
  `);

  // Widen product_images to allow this new type, and make it structurally
  // impossible for a size-guide photo to ever become the primary/card
  // thumbnail (belt-and-suspenders alongside the app code always passing
  // isPrimary: false for this type).
  pgm.sql(`
    ALTER TABLE product_images DROP CONSTRAINT IF EXISTS product_images_type_check;
  `);
  pgm.sql(`
    ALTER TABLE product_images
      ADD CONSTRAINT product_images_type_check CHECK (type IN ('ORIGINAL', 'AI_GENERATED', 'PRODUCT_SIZE'));
  `);
  pgm.sql(`
    ALTER TABLE product_images
      ADD CONSTRAINT product_images_size_never_primary_check
        CHECK (type != 'PRODUCT_SIZE' OR is_primary = false);
  `);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE product_images DROP CONSTRAINT IF EXISTS product_images_size_never_primary_check;`);
  pgm.sql(`ALTER TABLE product_images DROP CONSTRAINT IF EXISTS product_images_type_check;`);
  pgm.sql(`ALTER TABLE product_images ADD CONSTRAINT product_images_type_check CHECK (type IN ('ORIGINAL', 'AI_GENERATED'));`);
  pgm.sql('DROP TABLE IF EXISTS product_size_generated_images;');
};
