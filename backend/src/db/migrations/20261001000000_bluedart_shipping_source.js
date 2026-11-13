// Blue Dart as a second real courier alongside Delhivery — courier-driven
// tracking updates are written with the courier's own name as their
// `source`, so both source CHECK constraints need to accept 'BLUEDART'.
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE shipment_tracking_events DROP CONSTRAINT shipment_tracking_events_source_check;
    ALTER TABLE shipment_tracking_events ADD CONSTRAINT shipment_tracking_events_source_check
      CHECK (source IN ('MANUAL', 'SYSTEM', 'WEBHOOK', 'DELHIVERY', 'BLUEDART'));

    ALTER TABLE order_status_history DROP CONSTRAINT order_status_history_source_check;
    ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_source_check
      CHECK (source IN ('ADMIN', 'PAYMENT_GATEWAY', 'DELHIVERY', 'BLUEDART', 'CUSTOMER', 'SYSTEM'));
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    UPDATE shipment_tracking_events SET source = 'SYSTEM' WHERE source = 'BLUEDART';
    ALTER TABLE shipment_tracking_events DROP CONSTRAINT shipment_tracking_events_source_check;
    ALTER TABLE shipment_tracking_events ADD CONSTRAINT shipment_tracking_events_source_check
      CHECK (source IN ('MANUAL', 'SYSTEM', 'WEBHOOK', 'DELHIVERY'));

    UPDATE order_status_history SET source = 'SYSTEM' WHERE source = 'BLUEDART';
    ALTER TABLE order_status_history DROP CONSTRAINT order_status_history_source_check;
    ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_source_check
      CHECK (source IN ('ADMIN', 'PAYMENT_GATEWAY', 'DELHIVERY', 'CUSTOMER', 'SYSTEM'));
  `);
};
