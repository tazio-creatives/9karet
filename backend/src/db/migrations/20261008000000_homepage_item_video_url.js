// Homepage "Video Story" section: an item can carry an uploaded video (MP4 or
// WebM). The item's image_url, when set, is that video's poster frame.

export const up = (pgm) => {
  pgm.sql('ALTER TABLE homepage_items ADD COLUMN video_url TEXT;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE homepage_items DROP COLUMN video_url;');
};
