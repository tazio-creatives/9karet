// A return request could only ever have one reverse-pickup shipment, so a
// pickup Delhivery cancelled (or gave up on) couldn't be rebooked. Now: any
// number of pickups per return, but at most one that isn't cancelled — old
// attempts stay as history, marked REVERSE_PICKUP_CANCELLED when replaced.

export const up = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS shipments_return_request_id_idx;');
  pgm.sql(`
    CREATE UNIQUE INDEX shipments_return_request_id_idx ON shipments (return_request_id)
    WHERE return_request_id IS NOT NULL AND status <> 'REVERSE_PICKUP_CANCELLED';
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS shipments_return_request_id_idx;');
  pgm.sql(`
    CREATE UNIQUE INDEX shipments_return_request_id_idx ON shipments (return_request_id)
    WHERE return_request_id IS NOT NULL;
  `);
};
