// gold_rates, diamond_rates, product_price_history. See plan §9a.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE gold_rates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      purity TEXT NOT NULL CHECK (purity IN ('14K', '18K', '22K', '24K')),
      rate_per_gram NUMERIC(12, 2) NOT NULL,
      source TEXT NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX gold_rates_purity_fetched_idx ON gold_rates(purity, fetched_at DESC);');

  pgm.sql(`
    CREATE TABLE diamond_rates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rate_per_carat NUMERIC(12, 2) NOT NULL,
      set_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX diamond_rates_created_idx ON diamond_rates(created_at DESC);');

  pgm.sql(`
    CREATE TABLE product_price_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      old_selling_price NUMERIC(12, 2) NOT NULL,
      new_selling_price NUMERIC(12, 2) NOT NULL,
      gold_rate_id UUID REFERENCES gold_rates(id) ON DELETE SET NULL,
      reason TEXT NOT NULL CHECK (reason IN ('RATE_SYNC', 'ADMIN_MANUAL', 'DIAMOND_RATE_CHANGE')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(
    'CREATE INDEX product_price_history_product_id_idx ON product_price_history(product_id);',
  );
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS product_price_history;');
  pgm.sql('DROP TABLE IF EXISTS diamond_rates;');
  pgm.sql('DROP TABLE IF EXISTS gold_rates;');
};
