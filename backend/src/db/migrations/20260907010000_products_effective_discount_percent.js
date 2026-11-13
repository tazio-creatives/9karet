// List-view cards (products.controller.js's rowOffer/toListDto) show a
// product's offer badge/discounted price straight from the flat
// making_charge_discount_percent/diamond_discount_percent columns — but
// those are the admin-typed *default*, not purity-rule-aware. A product
// using Purity Pricing Rules (product_purity_pricing_rules) can have a real
// discount configured for its base purity that the PDP already resolves
// correctly (via computeVariantPricing) while list views stay blind to it.
//
// These two columns hold the *resolved* discount for the product's base
// configuration (purity rule ?? flat default), refreshed by
// productsService.applyBaseProductPricing alongside its price cache — kept
// deliberately separate from making_charge_discount_percent/
// diamond_discount_percent so an admin's own typed default is never
// silently overwritten by an unrelated purity-rule edit. NULL until the
// first refresh (rowOffer falls back to the flat columns in that case).
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      ADD COLUMN effective_making_charge_discount_percent NUMERIC(5, 2)
        CHECK (effective_making_charge_discount_percent IS NULL OR (effective_making_charge_discount_percent >= 0 AND effective_making_charge_discount_percent <= 100)),
      ADD COLUMN effective_diamond_discount_percent NUMERIC(5, 2)
        CHECK (effective_diamond_discount_percent IS NULL OR (effective_diamond_discount_percent >= 0 AND effective_diamond_discount_percent <= 100));
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE products
      DROP COLUMN IF EXISTS effective_making_charge_discount_percent,
      DROP COLUMN IF EXISTS effective_diamond_discount_percent;
  `);
};
