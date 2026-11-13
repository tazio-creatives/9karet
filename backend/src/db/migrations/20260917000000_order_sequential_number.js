// Sequential, human-friendly order numbers for NEW orders (BD0001, BD0002, …)
// — replaces the random-hex generator in src/utils/orderNumber.js.
// checkoutService.js stops passing orderNumber into insertOrderTx so this
// column DEFAULT fills it in atomically at insert time (no extra round trip,
// no race between concurrent checkouts). Existing orders keep their old
// BD-YYMMDD-HEX numbers — this only changes what gets generated going
// forward, not historical data.
export const up = (pgm) => {
  pgm.sql(`CREATE SEQUENCE order_number_seq START WITH 1;`);
  pgm.sql(`
    ALTER TABLE orders ALTER COLUMN order_number
      SET DEFAULT ('BD' || lpad(nextval('order_number_seq')::text, 4, '0'));
  `);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE orders ALTER COLUMN order_number DROP DEFAULT;`);
  pgm.sql(`DROP SEQUENCE IF EXISTS order_number_seq;`);
};
