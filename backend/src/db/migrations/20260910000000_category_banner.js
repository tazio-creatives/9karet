// Per-category full-width PLP banner (plan: "ADD FULL-WIDTH CATEGORY BANNER
// TO PRODUCT LISTING PAGE"). Nullable/disabled by default — every existing
// category renders exactly as before (plain H1 heading) until an admin
// opts in via banner_enabled on the category form.

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE categories
      ADD COLUMN banner_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN banner_eyebrow TEXT,
      ADD COLUMN banner_description TEXT,
      ADD COLUMN banner_image_url TEXT,
      ADD COLUMN banner_image_url_mobile TEXT,
      ADD COLUMN banner_alt_text TEXT,
      ADD COLUMN banner_text_color TEXT NOT NULL DEFAULT 'LIGHT',
      ADD COLUMN banner_text_position TEXT NOT NULL DEFAULT 'LEFT',
      ADD COLUMN banner_focal_position TEXT NOT NULL DEFAULT 'CENTER';
  `);
  pgm.sql(`
    ALTER TABLE categories
      ADD CONSTRAINT categories_banner_text_color_check CHECK (banner_text_color IN ('LIGHT', 'DARK')),
      ADD CONSTRAINT categories_banner_text_position_check CHECK (banner_text_position IN ('LEFT', 'CENTER', 'RIGHT')),
      ADD CONSTRAINT categories_banner_focal_position_check CHECK (banner_focal_position IN ('LEFT', 'CENTER', 'RIGHT'));
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE categories
      DROP COLUMN IF EXISTS banner_enabled,
      DROP COLUMN IF EXISTS banner_eyebrow,
      DROP COLUMN IF EXISTS banner_description,
      DROP COLUMN IF EXISTS banner_image_url,
      DROP COLUMN IF EXISTS banner_image_url_mobile,
      DROP COLUMN IF EXISTS banner_alt_text,
      DROP COLUMN IF EXISTS banner_text_color,
      DROP COLUMN IF EXISTS banner_text_position,
      DROP COLUMN IF EXISTS banner_focal_position;
  `);
};
