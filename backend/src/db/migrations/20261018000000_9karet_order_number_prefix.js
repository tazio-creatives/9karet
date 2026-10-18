// 9Karet order numbers: 9K0001, 9K0002, … instead of BOX's BD0001.
//
// The order number doubles as the Cashfree order_id, and 9Karet shares BOX's
// Cashfree merchant account — Cashfree requires order_id to be unique per
// account, so reusing BOX's BD-sequence would make 9Karet's first orders
// collide with BOX's existing ones and be rejected. The sequence itself is
// untouched (it keeps counting); only the prefix changes.

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE orders ALTER COLUMN order_number
      SET DEFAULT ('9K' || lpad(nextval('order_number_seq')::text, 4, '0'));
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE orders ALTER COLUMN order_number
      SET DEFAULT ('BD' || lpad(nextval('order_number_seq')::text, 4, '0'));
  `);
};
