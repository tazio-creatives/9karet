// Pricing Rule Management, Phase 1: cached amount-based discount columns on
// products (the existing effective_making_charge_discount_percent/
// effective_diamond_discount_percent cache is percent-only and can't
// represent a FIXED_AMOUNT or FIXED_AMOUNT_PER_CARAT rule), plus the
// product_price_history.reason CHECK fix the background repricing job
// (Phase 2) needs — done now, ahead of time, since it's a pure additive
// constraint change with zero behavioral effect until 'PRICING_RULE' is
// actually written.
//
// All new columns are nullable and untouched by this migration — every
// existing product's cached pricing stays byte-identical until the first
// time it's actually repriced by a rule (which cannot happen in Phase 1,
// since no admin UI to create a rule exists yet).
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      ADD COLUMN effective_making_charge_discount_amount NUMERIC(12,2),
      ADD COLUMN effective_diamond_discount_amount NUMERIC(12,2),
      ADD COLUMN effective_making_charge_rule_id UUID REFERENCES pricing_rules(id) ON DELETE SET NULL,
      ADD COLUMN effective_diamond_rule_id UUID REFERENCES pricing_rules(id) ON DELETE SET NULL,
      ADD COLUMN effective_diamond_breakdown JSONB;
  `);

  pgm.sql(`ALTER TABLE product_price_history DROP CONSTRAINT product_price_history_reason_check;`);
  pgm.sql(`
    ALTER TABLE product_price_history ADD CONSTRAINT product_price_history_reason_check
      CHECK (reason IN ('RATE_SYNC','ADMIN_MANUAL','DIAMOND_RATE_CHANGE','PRICING_RULE'));
  `);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE product_price_history DROP CONSTRAINT product_price_history_reason_check;`);
  pgm.sql(`
    ALTER TABLE product_price_history ADD CONSTRAINT product_price_history_reason_check
      CHECK (reason IN ('RATE_SYNC','ADMIN_MANUAL','DIAMOND_RATE_CHANGE'));
  `);
  pgm.sql(`
    ALTER TABLE products
      DROP COLUMN IF EXISTS effective_making_charge_discount_amount,
      DROP COLUMN IF EXISTS effective_diamond_discount_amount,
      DROP COLUMN IF EXISTS effective_making_charge_rule_id,
      DROP COLUMN IF EXISTS effective_diamond_rule_id,
      DROP COLUMN IF EXISTS effective_diamond_breakdown;
  `);
};
