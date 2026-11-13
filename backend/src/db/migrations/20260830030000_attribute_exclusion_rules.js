// Per-product pairwise exclusion rules — "this product's Rose Gold isn't
// offered in 9K" — replacing the single hardcoded, universal 9K/Rose rule
// that was retired when the attribute+variant model was built. A rule is a
// pair of attribute_values (from two different attributes, by convention —
// not DB-enforced) that can never appear together on an available variant
// for that product. Stored with the pair canonicalized (attribute_value_id_a
// < attribute_value_id_b as text) so a rule is representationally unique
// regardless of which value the admin picked first.
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE attribute_value_exclusion_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      attribute_value_id_a UUID NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
      attribute_value_id_b UUID NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (attribute_value_id_a <> attribute_value_id_b),
      UNIQUE (product_id, attribute_value_id_a, attribute_value_id_b)
    );
  `);
  pgm.sql(
    'CREATE INDEX attribute_value_exclusion_rules_product_id_idx ON attribute_value_exclusion_rules(product_id);',
  );

  // Tags a variant's is_available = false as rule-driven (vs. an admin's own
  // manual override) so rule sync can safely re-evaluate and revert it later
  // without ever touching a value the admin set by hand. NULL = not
  // rule-driven (default-available, or a manual admin override).
  pgm.sql(`
    ALTER TABLE product_variants
      ADD COLUMN excluded_by_rule_id UUID REFERENCES attribute_value_exclusion_rules(id) ON DELETE SET NULL;
  `);
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE product_variants DROP COLUMN IF EXISTS excluded_by_rule_id;');
  pgm.sql('DROP TABLE IF EXISTS attribute_value_exclusion_rules;');
};
