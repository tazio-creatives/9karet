// addresses — one default per user enforced via a real Postgres partial unique
// index (corrected per 2026-08-10, not application logic). page_cache — SSR
// render cache for the four public SEO route types. See plan §1a/§3/§26.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE addresses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'HOME' CHECK (type IN ('HOME', 'OFFICE', 'OTHER')),
      is_default BOOLEAN NOT NULL DEFAULT false,
      name TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      address_line TEXT NOT NULL,
      building TEXT,
      landmark TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'India',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX addresses_user_id_idx ON addresses(user_id);');
  pgm.sql(`
    CREATE UNIQUE INDEX addresses_one_default_per_user
      ON addresses(user_id)
      WHERE is_default = true;
  `);

  pgm.sql(`
    CREATE TABLE page_cache (
      url TEXT PRIMARY KEY,
      html TEXT NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS page_cache;');
  pgm.sql('DROP TABLE IF EXISTS addresses;');
};
