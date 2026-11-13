// Fixes a real bug surfaced by testing: deleting a product with a Size axis
// (a product-scoped attribute_value) fails with a FK violation. products
// cascade-deletes both product_variants and its own product-scoped
// attribute_values in the same DELETE; variant_attribute_values sits
// between them, referencing product_variants (ON DELETE CASCADE, fine) and
// attribute_values (was ON DELETE RESTRICT). Postgres doesn't guarantee the
// product_variants cascade fully clears variant_attribute_values before the
// attribute_values cascade evaluates its own RESTRICT, so the RESTRICT can
// trip even though every row involved is legitimately going away together.
//
// RESTRICT was meant to stop an admin deleting a *global* value (e.g. "18K")
// out from under variants on other, unrelated products — that protection is
// untouched: global values have product_id NULL, so they're never touched
// by a products-table cascade in the first place, and there's no standalone
// "delete an attribute value" admin action for this to guard against.
// Switching to CASCADE only changes behavior for the case that was actually
// broken: a whole product (and everything scoped to it) being deleted
// together.
export const up = (pgm) => {
  pgm.sql('ALTER TABLE variant_attribute_values DROP CONSTRAINT variant_attribute_values_attribute_value_id_fkey;');
  pgm.sql(`
    ALTER TABLE variant_attribute_values
      ADD CONSTRAINT variant_attribute_values_attribute_value_id_fkey
      FOREIGN KEY (attribute_value_id) REFERENCES attribute_values(id) ON DELETE CASCADE;
  `);
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE variant_attribute_values DROP CONSTRAINT variant_attribute_values_attribute_value_id_fkey;');
  pgm.sql(`
    ALTER TABLE variant_attribute_values
      ADD CONSTRAINT variant_attribute_values_attribute_value_id_fkey
      FOREIGN KEY (attribute_value_id) REFERENCES attribute_values(id) ON DELETE RESTRICT;
  `);
};
