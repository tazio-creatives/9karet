// Storefront "Contact Us" form submissions — kept in the database (not only
// emailed) so nothing is lost if the support inbox misses one, and so admins
// can track each message through NEW -> READ -> RESOLVED with an internal note.
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE contact_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      order_number TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'READ', 'RESOLVED')),
      admin_note TEXT,
      ip_address TEXT,
      user_agent TEXT,
      resolved_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX contact_messages_status_created_idx ON contact_messages(status, created_at DESC);');
  pgm.sql('CREATE INDEX contact_messages_created_idx ON contact_messages(created_at DESC);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS contact_messages;');
};
