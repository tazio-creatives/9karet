// Per-product promotional offer — a percentage discount admins can set on
// the Making Charge and/or Diamond Value, distinct from the existing MRP-vs-
// sellingPrice discount (that one is a manual admin-set price; this one is a
// live formula-based discount recomputed from the current gold rate/diamond
// rate every time). Defaults to 0 (no offer) so every existing product is
// byte-identical in price until an admin opts in.

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      ADD COLUMN making_charge_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (making_charge_discount_percent >= 0 AND making_charge_discount_percent <= 100),
      ADD COLUMN diamond_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (diamond_discount_percent >= 0 AND diamond_discount_percent <= 100);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      DROP COLUMN IF EXISTS making_charge_discount_percent,
      DROP COLUMN IF EXISTS diamond_discount_percent;
  `);
};
