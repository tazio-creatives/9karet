// Lets an admin hide the "Check Delivery & Availability" pincode widget on
// a per-product basis (e.g. made-to-order pieces with no fixed delivery
// estimate). Defaults to true so every existing product keeps showing it —
// this is an opt-out, not an opt-in.

export const up = (pgm) => {
  pgm.sql(
    'ALTER TABLE products ADD COLUMN show_delivery_checker BOOLEAN NOT NULL DEFAULT true;',
  );
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE products DROP COLUMN IF EXISTS show_delivery_checker;');
};
