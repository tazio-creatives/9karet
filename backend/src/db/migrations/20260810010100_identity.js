// users (customers, OTP-based), admin_roles, admin_users (password-based, separate flow).
// See plan §3 "Identity/auth" and §8 Session & Security Architecture.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_number TEXT NOT NULL UNIQUE, -- normalized international format, e.g. +919876543210
      full_name TEXT,
      email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE TABLE admin_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      permissions JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  pgm.sql(`
    CREATE TABLE admin_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE RESTRICT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX admin_users_role_id_idx ON admin_users(role_id);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS admin_users;');
  pgm.sql('DROP TABLE IF EXISTS admin_roles;');
  pgm.sql('DROP TABLE IF EXISTS users;');
};
