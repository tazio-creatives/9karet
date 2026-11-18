// Marks a product for the homepage "Product Tabs" section's Trending tab
// (set from the admin Products list, like is_best_seller). Off by default.

export const up = (pgm) => {
  pgm.sql('ALTER TABLE products ADD COLUMN is_trending BOOLEAN NOT NULL DEFAULT false;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE products DROP COLUMN IF EXISTS is_trending;');
};
