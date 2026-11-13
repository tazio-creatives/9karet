// Weight resolution hierarchy — lets a product declare "this weighs
// differently at this purity" or "...at this purity + size" as genuine,
// live-resolved defaults, distinct from an exact per-variant override
// (product_variants.gold_weight_grams, still the most specific level and
// unchanged by this migration) and from the product's own base weight
// (still the final fallback). Resolution order, most specific wins:
//   exact variant weight -> purity+size rule -> purity rule -> base weight
// A row with size_value_id NULL is a purity-only rule; both set is a
// purity+size rule. There is no size-only rule level — a size's weight is
// still set the existing way (seeded directly onto matching variants at
// creation time via the product's Sizes list), which already sits at the
// top "exact variant weight" level, so it isn't reintroduced here as a
// separate live level.
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE product_weight_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      purity_value_id UUID NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
      size_value_id UUID REFERENCES attribute_values(id) ON DELETE CASCADE,
      gold_weight_grams NUMERIC(10, 3) NOT NULL CHECK (gold_weight_grams > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Partial unique indexes (not a plain UNIQUE constraint) because Postgres
  // treats NULL as distinct from NULL in a regular unique constraint — the
  // same reasoning as attribute_values' global/scoped split.
  pgm.sql(`
    CREATE UNIQUE INDEX product_weight_rules_purity_only_idx
      ON product_weight_rules(product_id, purity_value_id) WHERE size_value_id IS NULL;
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX product_weight_rules_purity_size_idx
      ON product_weight_rules(product_id, purity_value_id, size_value_id) WHERE size_value_id IS NOT NULL;
  `);
  pgm.sql('CREATE INDEX product_weight_rules_product_id_idx ON product_weight_rules(product_id);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS product_weight_rules;');
};
