export const up = (pgm) => {
  // gen_random_uuid() is core in PG13+, but pgcrypto is enabled explicitly
  // for portability across environments.
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
};

export const down = (pgm) => {
  pgm.sql('DROP EXTENSION IF EXISTS pgcrypto;');
};
