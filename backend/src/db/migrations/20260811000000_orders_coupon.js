// orders.coupon_id / coupon_code — needed so the payment webhook (the only
// place a coupon is ever actually marked used, plan §11) knows which coupon
// to record usage for without re-deriving it from a discount amount alone.
// coupon_code is a snapshot (survives the coupon being edited/deleted later),
// same "order-time snapshot" philosophy as order_items' price fields.

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE orders
      ADD COLUMN coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
      ADD COLUMN coupon_code TEXT;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE orders
      DROP COLUMN IF EXISTS coupon_id,
      DROP COLUMN IF EXISTS coupon_code;
  `);
};
