// Diamond Type master (Pricing Rule Management, Phase 1). `products.diamond_type`
// has always been free text with no FK/enum — the new Pricing Rule Management
// system needs an exact, selectable set of diamond types (e.g. "Natural" vs
// "Lab-Grown") to scope diamond discount rules against, which free text can't
// reliably back ("Natural" / "natural " / "Natural Diamond" would silently
// fragment a rule's scope). `products.diamond_type` is deliberately kept, not
// dropped — existing reads keep working unchanged; a later phase switches the
// admin product form to write diamond_type_id and treats the TEXT column as a
// denormalized display copy.
export const up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE diamond_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`ALTER TABLE products ADD COLUMN diamond_type_id UUID REFERENCES diamond_types(id) ON DELETE RESTRICT;`);
  pgm.sql(`CREATE INDEX products_diamond_type_id_idx ON products(diamond_type_id) WHERE diamond_type_id IS NOT NULL;`);

  // Backfill: one diamond_types row per distinct trimmed, slugified value of
  // products.diamond_type. ON CONFLICT DO NOTHING absorbs the case where two
  // raw values normalize to the same slug (e.g. "Natural" vs "natural") —
  // whichever DISTINCT picks first wins the row, the rest merge into it.
  // Blank/whitespace-only/NULL diamond_type values are skipped entirely
  // (they mean "no type set", not a type named "").
  pgm.sql(`
    INSERT INTO diamond_types (name, slug)
    SELECT DISTINCT btrim(diamond_type), lower(regexp_replace(btrim(diamond_type), '\\s+', '-', 'g'))
    FROM products
    WHERE diamond_type IS NOT NULL AND btrim(diamond_type) <> ''
    ON CONFLICT (slug) DO NOTHING;
  `);

  pgm.sql(`
    UPDATE products p
    SET diamond_type_id = dt.id
    FROM diamond_types dt
    WHERE p.diamond_type IS NOT NULL
      AND btrim(p.diamond_type) <> ''
      AND lower(regexp_replace(btrim(p.diamond_type), '\\s+', '-', 'g')) = dt.slug;
  `);
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE products DROP COLUMN IF EXISTS diamond_type_id;');
  pgm.sql('DROP TABLE IF EXISTS diamond_types;');
};
