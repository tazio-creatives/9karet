// Marks a product for the homepage "Featured Product" section (auto-synced,
// same pattern as BENTO_CATEGORIES/NEW_ARRIVALS — see homepage.repository.js)
// instead of being manually attached via homepage_items.

export const up = (pgm) => {
  pgm.sql('ALTER TABLE products ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE products DROP COLUMN IF EXISTS is_featured;');
};
