// Optional free-text note a customer can leave at checkout (e.g. delivery
// instructions) — shown on both the customer's own order detail and the
// admin order detail page. See orders.repository.js's ORDER_COLUMNS and
// utils/orderDto.js.

export const up = (pgm) => {
  pgm.sql('ALTER TABLE orders ADD COLUMN delivery_note TEXT;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE orders DROP COLUMN IF EXISTS delivery_note;');
};
