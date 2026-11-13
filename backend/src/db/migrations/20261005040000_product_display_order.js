// Manual "First 50 Products" ordering — one independent order per placement
// (a homepage collection showcase, or a category page). Only reorders
// products the listing already shows; never adds, hides or duplicates any.
// product_id deliberately has no FK: a deleted product stays in the saved
// order (skipped on the storefront, flagged "Deleted product" in admin)
// until an admin removes it.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE product_display_order (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      placement_type TEXT NOT NULL CHECK (placement_type IN ('homepage_collection', 'category')),
      placement_id UUID NOT NULL,
      product_id UUID NOT NULL,
      position INT NOT NULL CHECK (position BETWEEN 1 AND 50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT product_display_order_product_unique UNIQUE (placement_type, placement_id, product_id),
      CONSTRAINT product_display_order_position_unique UNIQUE (placement_type, placement_id, position)
    );
  `);
  pgm.sql('CREATE INDEX product_display_order_product_idx ON product_display_order (product_id);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS product_display_order;');
};
