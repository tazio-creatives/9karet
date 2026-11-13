// Freezes the delivery estimate shown at checkout onto the order itself —
// deliberately NOT derived live from calculateDeliveryEstimate() on read,
// so an order placed today keeps showing today's window forever, even after
// "today" has long passed. See deliveryEstimateService.js (the single
// calculation this snapshots) and orders.repository.js's ORDER_COLUMNS.
//
// Confirmed before adding these: no existing "delivery"/"eta"/"shipping_date"
// columns on `orders` (the only prior delivery-related column is the
// unrelated free-text `delivery_note` from 20260901030000).

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE orders
      ADD COLUMN estimated_delivery_start_date DATE,
      ADD COLUMN estimated_delivery_end_date DATE,
      ADD COLUMN delivery_minimum_days INTEGER,
      ADD COLUMN delivery_maximum_days INTEGER;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE orders
      DROP COLUMN IF EXISTS estimated_delivery_start_date,
      DROP COLUMN IF EXISTS estimated_delivery_end_date,
      DROP COLUMN IF EXISTS delivery_minimum_days,
      DROP COLUMN IF EXISTS delivery_maximum_days;
  `);
};
