// Hero (and other banner-style) sections need a short descriptive line under
// the heading (plan §3 homepage_items) — was missing from the original
// column set, added here rather than overloading an existing field.

export const up = (pgm) => {
  pgm.sql('ALTER TABLE homepage_items ADD COLUMN subheading TEXT;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE homepage_items DROP COLUMN IF EXISTS subheading;');
};
