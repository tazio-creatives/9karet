// Phase 1 of the order-status redesign (see the plan for full context): splits the
// single `orders.status` field into three independent fields — payment_status,
// order_status, shipment_status — so payment/fulfillment/courier state stop being
// conflated. `status` itself is deliberately left in place, untouched, as a frozen
// legacy mirror: every not-yet-migrated read of `order.status` keeps working exactly
// as before, and it can be dropped in a later cleanup once nothing reads it anymore.
// No existing data is deleted or renamed.
export const up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED'));
  `);
  pgm.sql(`
    ALTER TABLE orders ADD COLUMN order_status TEXT
      CHECK (order_status IN (
        'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT',
        'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'DELIVERY_FAILED',
        'RETURN_INITIATED', 'RETURNED', 'CANCELLED'
      ));
  `);
  pgm.sql(`
    ALTER TABLE orders ADD COLUMN shipment_status TEXT NOT NULL DEFAULT 'NOT_CREATED'
      CHECK (shipment_status IN (
        'NOT_CREATED', 'SHIPMENT_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'REACHED_DESTINATION',
        'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'DELIVERY_FAILED', 'RTO_INITIATED',
        'RETURNED', 'CANCELLED'
      ));
  `);

  // Backfill every existing order from its legacy `status` value. CANCELLED is the one
  // ambiguous case (an order can be cancelled before or after payment succeeded) — join
  // `payments` to tell the two apart instead of guessing.
  pgm.sql(`UPDATE orders SET payment_status = 'PENDING' WHERE status = 'PENDING_PAYMENT';`);
  pgm.sql(`
    UPDATE orders SET payment_status = 'PAID', order_status = 'CONFIRMED'
    WHERE status = 'CONFIRMED';
  `);
  pgm.sql(`
    UPDATE orders SET payment_status = 'PAID', order_status = 'PROCESSING'
    WHERE status = 'PROCESSING';
  `);
  pgm.sql(`
    UPDATE orders SET payment_status = 'PAID', order_status = 'SHIPPED', shipment_status = 'SHIPMENT_CREATED'
    WHERE status = 'SHIPPED';
  `);
  pgm.sql(`
    UPDATE orders SET payment_status = 'PAID', order_status = 'OUT_FOR_DELIVERY', shipment_status = 'OUT_FOR_DELIVERY'
    WHERE status = 'OUT_FOR_DELIVERY';
  `);
  pgm.sql(`
    UPDATE orders SET payment_status = 'PAID', order_status = 'DELIVERED', shipment_status = 'DELIVERED'
    WHERE status = 'DELIVERED';
  `);
  pgm.sql(`UPDATE orders SET payment_status = 'FAILED' WHERE status IN ('PAYMENT_FAILED', 'EXPIRED');`);
  pgm.sql(`
    UPDATE orders o SET payment_status = 'PAID', order_status = 'CANCELLED'
    WHERE o.status = 'CANCELLED'
      AND EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'SUCCEEDED');
  `);
  pgm.sql(`
    UPDATE orders SET payment_status = 'FAILED', order_status = 'CANCELLED'
    WHERE status = 'CANCELLED' AND order_status IS NULL;
  `);
  pgm.sql(`
    UPDATE orders SET payment_status = 'PAID', order_status = 'RETURN_INITIATED'
    WHERE status = 'RETURN_REQUESTED';
  `);
  pgm.sql(`
    UPDATE orders SET payment_status = 'REFUNDED', order_status = 'RETURNED'
    WHERE status = 'REFUNDED';
  `);

  // order_items: the exact gold weight / diamond weight for the SPECIFIC ordered
  // variant is computed at checkout (pricingService.js) but was never persisted —
  // only derived ₹ values survived. Snapshotted here going forward so a work order
  // (or any other feature) always reflects what was actually purchased, never the
  // live/editable product. Existing rows stay NULL — there's no way to reconstruct
  // a historical weight after the fact once gold rates have moved on.
  pgm.sql(`ALTER TABLE order_items ADD COLUMN gold_weight_grams_snapshot NUMERIC(10, 3);`);
  pgm.sql(`ALTER TABLE order_items ADD COLUMN diamond_weight_carats_snapshot NUMERIC(10, 3);`);
  pgm.sql(`ALTER TABLE order_items ADD COLUMN diamond_count_snapshot INTEGER;`);
  pgm.sql(`ALTER TABLE order_items ADD COLUMN diamond_colour_snapshot TEXT;`);
  pgm.sql(`ALTER TABLE order_items ADD COLUMN diamond_clarity_snapshot TEXT;`);
  // New field entirely — no customization/engraving note existed anywhere before this.
  pgm.sql(`ALTER TABLE order_items ADD COLUMN customization_note TEXT;`);

  // order_status_history gains the actor + source tracking shipment_tracking_events
  // already had — today a manual admin status change is recorded with no record of
  // which admin made it.
  pgm.sql(`
    ALTER TABLE order_status_history ADD COLUMN actor_admin_user_id UUID
      REFERENCES admin_users(id) ON DELETE SET NULL;
  `);
  pgm.sql(`
    ALTER TABLE order_status_history ADD COLUMN source TEXT NOT NULL DEFAULT 'SYSTEM'
      CHECK (source IN ('ADMIN', 'PAYMENT_GATEWAY', 'DELHIVERY', 'SYSTEM'));
  `);

  pgm.sql(`CREATE INDEX orders_order_status_idx ON orders(order_status);`);
  pgm.sql(`CREATE INDEX orders_payment_status_idx ON orders(payment_status);`);
  pgm.sql(`CREATE INDEX orders_shipment_status_idx ON orders(shipment_status);`);
};

export const down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS orders_order_status_idx;`);
  pgm.sql(`DROP INDEX IF EXISTS orders_payment_status_idx;`);
  pgm.sql(`DROP INDEX IF EXISTS orders_shipment_status_idx;`);
  pgm.sql(`ALTER TABLE order_status_history DROP COLUMN IF EXISTS actor_admin_user_id;`);
  pgm.sql(`ALTER TABLE order_status_history DROP COLUMN IF EXISTS source;`);
  pgm.sql(`ALTER TABLE order_items DROP COLUMN IF EXISTS gold_weight_grams_snapshot;`);
  pgm.sql(`ALTER TABLE order_items DROP COLUMN IF EXISTS diamond_weight_carats_snapshot;`);
  pgm.sql(`ALTER TABLE order_items DROP COLUMN IF EXISTS diamond_count_snapshot;`);
  pgm.sql(`ALTER TABLE order_items DROP COLUMN IF EXISTS diamond_colour_snapshot;`);
  pgm.sql(`ALTER TABLE order_items DROP COLUMN IF EXISTS diamond_clarity_snapshot;`);
  pgm.sql(`ALTER TABLE order_items DROP COLUMN IF EXISTS customization_note;`);
  pgm.sql(`ALTER TABLE orders DROP COLUMN IF EXISTS payment_status;`);
  pgm.sql(`ALTER TABLE orders DROP COLUMN IF EXISTS order_status;`);
  pgm.sql(`ALTER TABLE orders DROP COLUMN IF EXISTS shipment_status;`);
};
