// pg_trgm-backed indexes for fast substring/fuzzy search (plan §6/§28:
// "indexed ILIKE/trigram ... server-side").

export const up = (pgm) => {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
  pgm.sql('CREATE INDEX products_name_trgm_idx ON products USING GIN (name gin_trgm_ops);');
  pgm.sql('CREATE INDEX products_sku_trgm_idx ON products USING GIN (sku gin_trgm_ops);');
  pgm.sql('CREATE INDEX categories_name_trgm_idx ON categories USING GIN (name gin_trgm_ops);');
  pgm.sql('CREATE INDEX collections_name_trgm_idx ON collections USING GIN (name gin_trgm_ops);');
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS collections_name_trgm_idx;');
  pgm.sql('DROP INDEX IF EXISTS categories_name_trgm_idx;');
  pgm.sql('DROP INDEX IF EXISTS products_sku_trgm_idx;');
  pgm.sql('DROP INDEX IF EXISTS products_name_trgm_idx;');
  pgm.sql('DROP EXTENSION IF EXISTS pg_trgm;');
};
