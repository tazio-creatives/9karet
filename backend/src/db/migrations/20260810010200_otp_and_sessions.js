// otp_verifications: standalone, never touches users.password. See plan §3/§7/§12.
// customer_sessions / admin_sessions: shaped for connect-pg-simple (sid/sess/expire),
// kept as two separate tables so customer and admin sessions never share storage. See §8.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE otp_verifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_number TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK (purpose IN ('LOGIN', 'SIGNUP', 'CHECKOUT', 'PHONE_CHANGE')),
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(
    'CREATE INDEX otp_verifications_mobile_purpose_created_idx ON otp_verifications(mobile_number, purpose, created_at);',
  );

  for (const table of ['customer_sessions', 'admin_sessions']) {
    pgm.sql(`
      CREATE TABLE ${table} (
        sid VARCHAR NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );
    `);
    pgm.sql(`CREATE INDEX ${table}_expire_idx ON ${table}(expire);`);
  }
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS admin_sessions;');
  pgm.sql('DROP TABLE IF EXISTS customer_sessions;');
  pgm.sql('DROP TABLE IF EXISTS otp_verifications;');
};
