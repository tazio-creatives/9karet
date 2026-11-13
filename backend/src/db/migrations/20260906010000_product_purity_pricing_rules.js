// Product + Purity pricing overrides — making charge %, making charge
// discount %, and diamond discount % all currently live only on `products`
// (one flat value for the whole product, every purity). This table lets an
// admin override any subset of those three fields per purity, independent
// of the (unrelated) product_weight_rules table, which already handles the
// Product + Purity (+ Size) *weight* dimension. Deliberately no size
// dimension here — the business requirement is Product + Purity only, every
// size under that purity shares the same charge/discount.
//
// All three numeric columns are nullable, and nullability is meaningful:
// NULL = inherit the product-level default for that one field; a row can
// mix overridden and inherited fields (e.g. override making charge but
// inherit the discount). A product with no row at all for a purity means
// total inheritance from product-level defaults — computeVariantPricing
// must resolve field-by-field with `??`, never `||` (0 is a valid override).
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE product_purity_pricing_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      purity_value_id UUID NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
      making_charge_percent NUMERIC(5, 2) CHECK (making_charge_percent IS NULL OR (making_charge_percent >= 0 AND making_charge_percent <= 100)),
      making_charge_discount_percent NUMERIC(5, 2) CHECK (making_charge_discount_percent IS NULL OR (making_charge_discount_percent >= 0 AND making_charge_discount_percent <= 100)),
      diamond_discount_percent NUMERIC(5, 2) CHECK (diamond_discount_percent IS NULL OR (diamond_discount_percent >= 0 AND diamond_discount_percent <= 100)),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (product_id, purity_value_id)
    );
  `);
  pgm.sql('CREATE INDEX product_purity_pricing_rules_product_id_idx ON product_purity_pricing_rules(product_id);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS product_purity_pricing_rules;');
};
