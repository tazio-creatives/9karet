// Reverse pickup (return-to-warehouse courier collection) — reuses the
// existing shipments/shipment_tracking_events infrastructure (same table,
// same tracking-sync job pattern) rather than a parallel set of tables,
// since shipments.order_id already allows more than one row per order.
// `direction` distinguishes a REVERSE (customer -> warehouse) row from the
// existing FORWARD (warehouse -> customer) ones; findShipmentByOrderId is
// updated in the same change to filter on it so it keeps returning the
// forward shipment once a reverse pickup row also exists for the order.
export const up = (pgm) => {
  pgm.sql(`ALTER TABLE shipments ADD COLUMN direction TEXT NOT NULL DEFAULT 'FORWARD' CHECK (direction IN ('FORWARD', 'REVERSE'));`);
  pgm.sql(`ALTER TABLE shipments ADD COLUMN return_request_id UUID REFERENCES return_requests(id) ON DELETE CASCADE;`);
  pgm.sql(`
    CREATE UNIQUE INDEX shipments_return_request_id_idx
      ON shipments(return_request_id)
      WHERE return_request_id IS NOT NULL;
  `);

  // Reverse-pickup-specific status values added to the same shared column —
  // distinct names from the forward vocabulary (never "DELIVERED", which
  // would ambiguously read as "delivered to the customer" in shared UI).
  pgm.sql(`ALTER TABLE shipments DROP CONSTRAINT shipments_status_check;`);
  pgm.sql(`
    ALTER TABLE shipments ADD CONSTRAINT shipments_status_check CHECK (status IN (
      'NOT_CREATED', 'SHIPMENT_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'REACHED_DESTINATION',
      'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'DELIVERY_FAILED', 'RTO_INITIATED',
      'RETURNED', 'CANCELLED',
      'REVERSE_PICKUP_SCHEDULED', 'REVERSE_PICKED_UP', 'REVERSE_IN_TRANSIT',
      'REVERSE_RECEIVED', 'REVERSE_PICKUP_FAILED', 'REVERSE_PICKUP_CANCELLED'
    ));
  `);

  // The tracking-sync job's poll query excludes terminal states — the
  // reverse-pickup terminal states need to be excluded too, or a completed
  // reverse pickup gets polled forever.
  pgm.sql('DROP INDEX IF EXISTS shipments_pending_tracking_idx;');
  pgm.sql(`
    CREATE INDEX shipments_pending_tracking_idx ON shipments(status)
      WHERE status NOT IN ('DELIVERED', 'RETURNED', 'CANCELLED', 'REVERSE_RECEIVED', 'REVERSE_PICKUP_CANCELLED');
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS shipments_pending_tracking_idx;');
  pgm.sql(`
    CREATE INDEX shipments_pending_tracking_idx ON shipments(status)
      WHERE status NOT IN ('DELIVERED', 'RETURNED', 'CANCELLED');
  `);
  pgm.sql(`ALTER TABLE shipments DROP CONSTRAINT shipments_status_check;`);
  pgm.sql(`
    ALTER TABLE shipments ADD CONSTRAINT shipments_status_check CHECK (status IN (
      'NOT_CREATED', 'SHIPMENT_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'REACHED_DESTINATION',
      'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'DELIVERY_FAILED', 'RTO_INITIATED',
      'RETURNED', 'CANCELLED'
    ));
  `);
  pgm.sql('DROP INDEX IF EXISTS shipments_return_request_id_idx;');
  pgm.sql('ALTER TABLE shipments DROP COLUMN return_request_id;');
  pgm.sql('ALTER TABLE shipments DROP COLUMN direction;');
};
