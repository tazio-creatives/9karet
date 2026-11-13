// Phase 3 (Delhivery integration). Adds the package-details-at-creation
// fields a real courier shipment needs (collected in the admin "Mark Ready
// to Ship" modal — see the plan: no new product-catalog weight/dimension
// fields, admin enters these per-shipment) plus a label URL and a
// last-synced timestamp the tracking-sync job uses.
//
// Also formalizes shipments.status onto the SAME vocabulary as
// orders.shipment_status (utils/orderStatus.js#SHIPMENT_STATUSES) — it was
// free text with no constraint before, and every write going forward uses
// that shared vocabulary, so the two columns should agree on what's valid.
// The two existing dev-only test rows ('SHIPPED'/'DELIVERED' from the old
// stub-only flow) are backfilled before the CHECK is added.
export const up = (pgm) => {
  pgm.sql(`ALTER TABLE shipments ADD COLUMN package_weight_grams NUMERIC(10, 2);`);
  pgm.sql(`ALTER TABLE shipments ADD COLUMN package_length_cm NUMERIC(6, 2);`);
  pgm.sql(`ALTER TABLE shipments ADD COLUMN package_width_cm NUMERIC(6, 2);`);
  pgm.sql(`ALTER TABLE shipments ADD COLUMN package_height_cm NUMERIC(6, 2);`);
  pgm.sql(`ALTER TABLE shipments ADD COLUMN label_url TEXT;`);
  pgm.sql(`ALTER TABLE shipments ADD COLUMN last_tracked_at TIMESTAMPTZ;`);

  pgm.sql(`UPDATE shipments SET status = 'PICKED_UP' WHERE status = 'SHIPPED';`);
  pgm.sql(`UPDATE shipments SET status = 'SHIPMENT_CREATED' WHERE status = 'PENDING';`);
  pgm.sql(`
    ALTER TABLE shipments ADD CONSTRAINT shipments_status_check CHECK (status IN (
      'NOT_CREATED', 'SHIPMENT_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'REACHED_DESTINATION',
      'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'DELIVERY_FAILED', 'RTO_INITIATED',
      'RETURNED', 'CANCELLED'
    ));
  `);
  pgm.sql(`ALTER TABLE shipments ALTER COLUMN status SET DEFAULT 'SHIPMENT_CREATED';`);

  // The tracking-sync job's poll query — only shipments not yet in a
  // terminal state need to be re-checked.
  pgm.sql(`
    CREATE INDEX shipments_pending_tracking_idx ON shipments(status)
      WHERE status NOT IN ('DELIVERED', 'RETURNED', 'CANCELLED');
  `);

  // order_status_history already allowed a 'DELHIVERY' source (added ahead
  // of time by the 20260918000000 migration); shipment_tracking_events
  // only had MANUAL/SYSTEM/WEBHOOK — widened here so a sync-job-written
  // tracking event is attributed accurately rather than mislabeled SYSTEM.
  pgm.sql(`ALTER TABLE shipment_tracking_events DROP CONSTRAINT shipment_tracking_events_source_check;`);
  pgm.sql(`
    ALTER TABLE shipment_tracking_events ADD CONSTRAINT shipment_tracking_events_source_check
      CHECK (source IN ('MANUAL', 'SYSTEM', 'WEBHOOK', 'DELHIVERY'));
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE shipment_tracking_events DROP CONSTRAINT shipment_tracking_events_source_check;
  `);
  pgm.sql(`
    ALTER TABLE shipment_tracking_events ADD CONSTRAINT shipment_tracking_events_source_check
      CHECK (source IN ('MANUAL', 'SYSTEM', 'WEBHOOK'));
  `);
  pgm.sql(`DROP INDEX IF EXISTS shipments_pending_tracking_idx;`);
  pgm.sql(`ALTER TABLE shipments ALTER COLUMN status SET DEFAULT 'PENDING';`);
  pgm.sql(`ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;`);
  pgm.sql(`ALTER TABLE shipments DROP COLUMN IF EXISTS package_weight_grams;`);
  pgm.sql(`ALTER TABLE shipments DROP COLUMN IF EXISTS package_length_cm;`);
  pgm.sql(`ALTER TABLE shipments DROP COLUMN IF EXISTS package_width_cm;`);
  pgm.sql(`ALTER TABLE shipments DROP COLUMN IF EXISTS package_height_cm;`);
  pgm.sql(`ALTER TABLE shipments DROP COLUMN IF EXISTS label_url;`);
  pgm.sql(`ALTER TABLE shipments DROP COLUMN IF EXISTS last_tracked_at;`);
};
