// Hero banners need a separate mobile crop — a wide desktop photo squeezed
// into a narrow mobile viewport via cover-crop loses the subject off the
// sides. Nullable: falls back to image_url when not set, so existing items
// keep working unchanged.

export const up = (pgm) => {
  pgm.sql('ALTER TABLE homepage_items ADD COLUMN image_url_mobile TEXT;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE homepage_items DROP COLUMN IF EXISTS image_url_mobile;');
};
