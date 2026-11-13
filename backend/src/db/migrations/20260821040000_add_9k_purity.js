// Adds 9K as a valid gold purity alongside the existing 14/18/22/24K tiers.

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE products DROP CONSTRAINT products_purity_check`);
  pgm.sql(
    `ALTER TABLE products ADD CONSTRAINT products_purity_check CHECK (purity IN ('9K', '14K', '18K', '22K', '24K'))`,
  );

  pgm.sql(`ALTER TABLE gold_rates DROP CONSTRAINT gold_rates_purity_check`);
  pgm.sql(
    `ALTER TABLE gold_rates ADD CONSTRAINT gold_rates_purity_check CHECK (purity IN ('9K', '14K', '18K', '22K', '24K'))`,
  );
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE products DROP CONSTRAINT products_purity_check`);
  pgm.sql(
    `ALTER TABLE products ADD CONSTRAINT products_purity_check CHECK (purity IN ('14K', '18K', '22K', '24K'))`,
  );

  pgm.sql(`ALTER TABLE gold_rates DROP CONSTRAINT gold_rates_purity_check`);
  pgm.sql(
    `ALTER TABLE gold_rates ADD CONSTRAINT gold_rates_purity_check CHECK (purity IN ('14K', '18K', '22K', '24K'))`,
  );
};
