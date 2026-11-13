// Section-level subtitle and button (e.g. the Collections Carousel's
// "Find your style…" line and its "View All Collections" button). Optional
// for every section type; only types that render them use them.

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE homepage_sections
      ADD COLUMN subheading TEXT,
      ADD COLUMN cta_label TEXT,
      ADD COLUMN cta_url TEXT;
  `);
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE homepage_sections DROP COLUMN subheading, DROP COLUMN cta_label, DROP COLUMN cta_url;');
};
