// Per-category SEO (title tag, meta description, H1) editable in admin; the
// existing `description` is the short visible intro under the H1. Seeds the
// six main jewellery categories by NAME (live slugs differ from names, e.g.
// Bangle lives at /nose-pin) and only fills fields that are still empty, so
// it never overwrites an admin's own wording.

const SEED = [
  {
    names: ['rings', 'ring'],
    seoTitle: 'Natural Diamond Rings for Women | BOX DIAMONDS',
    seoDescription:
      'Shop certified natural diamond rings for women at BOX DIAMONDS. Explore elegant designs crafted for everyday wear, gifting and special occasions.',
    seoHeading: 'Natural Diamond Rings',
    intro:
      'Discover certified natural diamond rings for women, set in BIS hallmarked gold — designs for everyday wear, engagements and celebrations. Shop diamond rings online in India with transparent pricing.',
  },
  {
    names: ['earrings', 'earring'],
    seoTitle: 'Natural Diamond Earrings for Women | BOX DIAMONDS',
    seoDescription:
      'Shop certified natural diamond earrings for women at BOX DIAMONDS. Elegant designs in hallmarked gold, made for everyday wear and thoughtful gifting.',
    seoHeading: 'Natural Diamond Earrings',
    intro:
      'Our certified natural diamond earrings add a quiet sparkle to every look, from the office to celebrations. Each pair is crafted in BIS hallmarked gold and delivered across India.',
  },
  {
    names: ['necklaces', 'necklace'],
    seoTitle: 'Natural Diamond Necklaces for Women | BOX DIAMONDS',
    seoDescription:
      'Explore certified natural diamond necklaces for women at BOX DIAMONDS. Fine diamond necklace designs in hallmarked gold for weddings, gifting and everyday wear.',
    seoHeading: 'Natural Diamond Necklaces',
    intro:
      'Find a certified natural diamond necklace for every occasion, from everyday elegance to weddings and festivities — all crafted in BIS hallmarked gold.',
  },
  {
    names: ['pendants', 'pendant'],
    seoTitle: 'Natural Diamond Pendants for Women | BOX DIAMONDS',
    seoDescription:
      'Shop certified natural diamond pendants for women at BOX DIAMONDS. Minimal and statement diamond pendant designs in hallmarked gold, delivered across India.',
    seoHeading: 'Natural Diamond Pendants',
    intro:
      'Our certified natural diamond pendants are designed to be worn every day and treasured for years — simple, meaningful pieces in BIS hallmarked gold that make a perfect gift.',
  },
  {
    names: ['bangles', 'bangle'],
    seoTitle: 'Natural Diamond Bangles for Women | BOX DIAMONDS',
    seoDescription:
      'Discover certified natural diamond bangles for women at BOX DIAMONDS. Elegant diamond bangle designs in hallmarked gold for daily wear and celebrations.',
    seoHeading: 'Natural Diamond Bangles',
    intro:
      'Elegant certified natural diamond bangles that move easily from workday to celebration. Each bangle is crafted in BIS hallmarked gold — shop diamond bangles online in India.',
  },
  {
    names: ['bracelets', 'bracelet'],
    seoTitle: 'Natural Diamond Bracelets for Women | BOX DIAMONDS',
    seoDescription:
      'Shop certified natural diamond bracelets for women at BOX DIAMONDS. Refined diamond bracelet designs in hallmarked gold for everyday luxury and gifting.',
    seoHeading: 'Natural Diamond Bracelets',
    intro:
      'Add effortless sparkle to your wrist with certified natural diamond bracelets in BIS hallmarked gold — refined designs for everyday wear, gifting and special moments.',
  },
];

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE categories
      ADD COLUMN seo_title TEXT,
      ADD COLUMN seo_description TEXT,
      ADD COLUMN seo_heading TEXT;
  `);
  const q = (s) => `'${s.replace(/'/g, "''")}'`;
  for (const c of SEED) {
    const where = `parent_id IS NULL AND lower(name) IN (${c.names.map(q).join(', ')})`;
    pgm.sql(`
      UPDATE categories SET
        seo_title = COALESCE(NULLIF(seo_title, ''), ${q(c.seoTitle)}),
        seo_description = COALESCE(NULLIF(seo_description, ''), ${q(c.seoDescription)}),
        seo_heading = COALESCE(NULLIF(seo_heading, ''), ${q(c.seoHeading)}),
        description = COALESCE(NULLIF(description, ''), ${q(c.intro)})
      WHERE ${where};
    `);
  }
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE categories DROP COLUMN seo_title, DROP COLUMN seo_description, DROP COLUMN seo_heading;');
};
