// stock_reservations — see plan §3/§11 (concurrency-safe via SELECT ... FOR UPDATE
// in application code; this migration just defines the table/indexes that support it).

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE stock_reservations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONFIRMED', 'RELEASED')),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(
    'CREATE INDEX stock_reservations_product_status_idx ON stock_reservations(product_id, status);',
  );
  pgm.sql(
    'CREATE INDEX stock_reservations_expires_status_idx ON stock_reservations(expires_at, status);',
  );
  pgm.sql('CREATE INDEX stock_reservations_order_id_idx ON stock_reservations(order_id);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS stock_reservations;');
};
