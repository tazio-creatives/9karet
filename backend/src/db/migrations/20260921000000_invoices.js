// GST-compliant tax invoice numbering (format: BD/<FY>/<0001>, e.g.
// BD/26-27/0001 for a sale made in the April 2026-March 2027 financial
// year) — deliberately separate from order_number (a plain internal
// identifier, already assigned at order placement). An invoice number must
// be assigned exactly once and never reused/skipped, so it can't reuse
// order_number_seq's simple "always increasing" sequence: it needs a
// counter that resets per financial year, which a plain Postgres SEQUENCE
// can't do on its own.
export const up = (pgm) => {
  pgm.sql(`ALTER TABLE orders ADD COLUMN invoice_number TEXT UNIQUE;`);
  pgm.sql(`ALTER TABLE orders ADD COLUMN invoice_generated_at TIMESTAMPTZ;`);

  // One row per financial year, atomically incremented via
  // INSERT ... ON CONFLICT DO UPDATE ... RETURNING (race-safe under
  // concurrent requests without needing a separate advisory lock).
  pgm.sql(`
    CREATE TABLE invoice_number_counters (
      financial_year TEXT PRIMARY KEY,
      next_seq INTEGER NOT NULL DEFAULT 1
    );
  `);

  // Mirrors work_order_prints — an admin-internal print/reprint audit log,
  // not part of the customer-visible order timeline.
  pgm.sql(`
    CREATE TABLE invoice_prints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      printed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX invoice_prints_order_id_idx ON invoice_prints(order_id, printed_at);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS invoice_prints;');
  pgm.sql('DROP TABLE IF EXISTS invoice_number_counters;');
  pgm.sql('ALTER TABLE orders DROP COLUMN IF EXISTS invoice_number;');
  pgm.sql('ALTER TABLE orders DROP COLUMN IF EXISTS invoice_generated_at;');
};
