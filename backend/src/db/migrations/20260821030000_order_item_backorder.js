// Make-to-Order backorder flag, per order line. A line whose requested
// quantity exceeded available stock at checkout is fulfilled without a
// physical stock reservation — this flag is what lets order history/admin
// show that after the fact, independent of whatever stock looks like later.

export const up = (pgm) => {
  pgm.sql('ALTER TABLE order_items ADD COLUMN is_backordered BOOLEAN NOT NULL DEFAULT false;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE order_items DROP COLUMN IF EXISTS is_backordered;');
};
