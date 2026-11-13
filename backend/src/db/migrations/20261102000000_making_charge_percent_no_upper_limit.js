// Making charge is a % of the gold value, not a share of the price — on 9K
// gold it can legitimately be above 100%, which the original <= 100 CHECKs
// (and NUMERIC(5,2), max 999.99) rejected. This drops the upper bound on
// making_charge_percent only, keeps it non-negative, and widens the column.
// The *discount* percent columns keep their 0–100 range untouched.
//
// The CHECKs were declared inline, so their names are Postgres-generated —
// they are looked up by definition instead of guessed, so an old upper bound
// can never silently survive a mismatched name.

const TABLES = [
  { table: 'products', nullable: false },
  { table: 'product_purity_pricing_rules', nullable: true },
];

function dropMakingChargeChecks(table) {
  return `
    DO $$
    DECLARE c record;
    BEGIN
      FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = '${table}'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%making_charge_percent%'
          AND pg_get_constraintdef(oid) NOT LIKE '%discount%'
      LOOP
        EXECUTE format('ALTER TABLE ${table} DROP CONSTRAINT %I', c.conname);
      END LOOP;
    END $$;
  `;
}

export const up = (pgm) => {
  for (const { table, nullable } of TABLES) {
    pgm.sql(dropMakingChargeChecks(table));
    pgm.sql(`ALTER TABLE ${table} ALTER COLUMN making_charge_percent TYPE NUMERIC(7, 2);`);
    pgm.sql(`
      ALTER TABLE ${table} ADD CONSTRAINT ${table}_making_charge_percent_check
        CHECK (${nullable ? 'making_charge_percent IS NULL OR ' : ''}making_charge_percent >= 0);
    `);
  }
};

// Restoring the 100% cap fails if any row has since been saved above 100% —
// those rows must be corrected first; the down migration never rewrites
// prices silently.
export const down = (pgm) => {
  for (const { table, nullable } of TABLES) {
    pgm.sql(dropMakingChargeChecks(table));
    pgm.sql(`ALTER TABLE ${table} ALTER COLUMN making_charge_percent TYPE NUMERIC(5, 2);`);
    pgm.sql(`
      ALTER TABLE ${table} ADD CONSTRAINT ${table}_making_charge_percent_check
        CHECK (${nullable ? 'making_charge_percent IS NULL OR ' : ''}(making_charge_percent >= 0 AND making_charge_percent <= 100));
    `);
  }
};
