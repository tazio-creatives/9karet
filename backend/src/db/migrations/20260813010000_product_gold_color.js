// Distinguishes gold color (Yellow/Rose/White) for the PLP "Metal" filter —
// separate from purity (14K/18K/22K/24K), which measures gold fineness, not
// color. Nullable: irrelevant for platinum products, and unset until an
// admin sets it on existing gold products.

export const up = (pgm) => {
  pgm.sql("ALTER TABLE products ADD COLUMN gold_color TEXT NULL;");
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE products DROP COLUMN IF EXISTS gold_color;');
};
