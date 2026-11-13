// Making charge has always been a flat ₹ number, frozen at whatever it was
// when an admin last saved the product — it never scaled when a shopper
// picked a different purity/size (computeVariantPricing already recomputes
// goldValue for those, but reads making_charge as a fixed passthrough), nor
// when the nightly gold-rate recalculation moved gold_value. This column
// makes making charge a live % of gold value instead, per product, set by
// the admin — nullable so every existing/non-gold product (making a % of a
// $0 gold value meaningless) stays on the flat making_charge column exactly
// as before until an admin opts a product in.
export const up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      ADD COLUMN making_charge_percent NUMERIC(5,2)
        CHECK (making_charge_percent >= 0 AND making_charge_percent <= 100);
  `);

  // Backfill GOLD products with a real gold value so today's price doesn't
  // silently jump the moment this ships — the % is derived from each
  // product's own current flat making_charge/gold_value ratio (its
  // effective % right now), capped at 100. Non-gold products (gold_value=0)
  // are deliberately left NULL, staying on the flat making_charge column.
  pgm.sql(`
    UPDATE products
    SET making_charge_percent = LEAST(ROUND((making_charge / gold_value) * 100, 2), 100)
    WHERE metal_type = 'GOLD' AND gold_value > 0;
  `);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE products DROP COLUMN IF EXISTS making_charge_percent;`);
};
