// Optional display image for a category (e.g. PLP header banner). Nullable —
// categories work fine with none, and the 4 existing seeded categories don't
// have one yet.

export const up = (pgm) => {
  pgm.sql('ALTER TABLE categories ADD COLUMN image_url TEXT;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE categories DROP COLUMN IF EXISTS image_url;');
};
