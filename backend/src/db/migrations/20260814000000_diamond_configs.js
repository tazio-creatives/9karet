// Diamond quality tiers — replaces the single global diamond_rates value.
// Each tier is a free-form name + a manual rate/carat (no live feed, same
// as the flat rate it replaces); a product picks one tier instead of
// pricing every diamond identically. diamond_rates is left untouched
// (real audit history), just no longer read from or written to.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE diamond_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      rate_per_carat NUMERIC(12, 2) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(
    'ALTER TABLE products ADD COLUMN diamond_config_id UUID REFERENCES diamond_configs(id) ON DELETE RESTRICT;',
  );
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE products DROP COLUMN IF EXISTS diamond_config_id;');
  pgm.sql('DROP TABLE IF EXISTS diamond_configs;');
};
