// Shipment history timeline. The `shipments` table only ever holds current
// status (one row, overwritten in place) — this adds an append-only event
// log so the order detail page can show a real history, not just "now."
// source distinguishes how an entry got here: SYSTEM = the stub provider's
// own ship/cancel actions, WEBHOOK = shippingService.confirmTrackingUpdate
// (the exact function a real courier's webhook will call once one is wired
// up, so no controller change is needed later — just a real provider), and
// MANUAL = an admin logging an update by hand in the meantime.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE shipment_tracking_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      location TEXT,
      note TEXT,
      source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'SYSTEM', 'WEBHOOK')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(
    'CREATE INDEX shipment_tracking_events_shipment_id_idx ON shipment_tracking_events(shipment_id, created_at);',
  );
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS shipment_tracking_events;');
};
