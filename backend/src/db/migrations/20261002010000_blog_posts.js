// Admin-managed storefront blog. `content` is a small, safe Markdown subset
// (headings, paragraphs, lists, quotes, bold/italic, links, images) that the
// storefront renders to React elements itself — never raw HTML.
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE blog_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      excerpt TEXT,
      cover_image_url TEXT,
      cover_image_alt TEXT,
      content TEXT NOT NULL DEFAULT '',
      author_name TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
      published_at TIMESTAMPTZ,
      seo_title TEXT,
      seo_description TEXT,
      created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(
    "CREATE INDEX blog_posts_published_idx ON blog_posts(published_at DESC) WHERE status = 'PUBLISHED';",
  );
  pgm.sql('CREATE INDEX blog_posts_updated_idx ON blog_posts(updated_at DESC);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS blog_posts;');
};
