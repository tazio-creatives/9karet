// Admin-settable "Best Seller" flag (Products list, same pattern as
// is_featured) — combined with actual sales volume (order_items) at query
// time to rank the storefront's Best Sellers rail. See products.repository.js
// listProducts()'s 'bestseller' sort branch.

export const up = (pgm) => {
  pgm.sql('ALTER TABLE products ADD COLUMN is_best_seller BOOLEAN NOT NULL DEFAULT false;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE products DROP COLUMN IF EXISTS is_best_seller;');
};
