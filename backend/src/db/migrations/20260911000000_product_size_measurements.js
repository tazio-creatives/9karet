// Manually-entered product dimensions for the optional "Product Size Image"
// feature (plan: "ADD FULL-WIDTH... ADD DYNAMIC..." — no, see the Product
// Size Image plan). One row per product, always editable independent of any
// generated image — `version` is bumped by the repository's upsert whenever
// any field actually changes, and is what product_size_generated_images
// checks against to decide whether a previously-generated image is stale.
//
// Deliberately distinct from the pre-existing, unrelated `products
// .product_size` free-text column (a customer-facing ring/chain size label,
// e.g. "7", set on the product form) — do not confuse the two.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE product_size_measurements (
      product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
      jewellery_type TEXT,
      unit TEXT NOT NULL CHECK (unit IN ('mm', 'cm')),
      measurements JSONB NOT NULL DEFAULT '{}',
      included_parts JSONB NOT NULL DEFAULT '[]',
      excluded_parts JSONB NOT NULL DEFAULT '[]',
      note TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS product_size_measurements;');
};
