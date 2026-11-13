import { query } from '../config/db.js';

// A post is publicly visible only once PUBLISHED and its publish time has
// arrived — a future published_at acts as a simple schedule.
const PUBLIC_WHERE = "status = 'PUBLISHED' AND published_at <= now()";

const LIST_COLUMNS = `id, title, slug, excerpt, cover_image_url, cover_image_alt, author_name, status,
  published_at, created_at, updated_at, length(regexp_replace(content, '\\s+', ' ', 'g')) AS content_length`;

export async function findPublishedPosts({ page = 1, limit = 12 }) {
  const offset = (page - 1) * limit;
  const { rows } = await query(
    `SELECT ${LIST_COLUMNS} FROM blog_posts WHERE ${PUBLIC_WHERE}
     ORDER BY published_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const {
    rows: [{ count }],
  } = await query(`SELECT COUNT(*)::int AS count FROM blog_posts WHERE ${PUBLIC_WHERE}`);
  return { items: rows, total: count };
}

export async function findPublishedPostBySlug(slug) {
  const { rows } = await query(`SELECT * FROM blog_posts WHERE slug = $1 AND ${PUBLIC_WHERE}`, [slug]);
  return rows[0] ?? null;
}

// "More from the blog" under a post — latest published posts except this one.
export async function findOtherPublishedPosts(excludeId, limit = 3) {
  const { rows } = await query(
    `SELECT ${LIST_COLUMNS} FROM blog_posts WHERE ${PUBLIC_WHERE} AND id <> $1
     ORDER BY published_at DESC LIMIT $2`,
    [excludeId, limit],
  );
  return rows;
}

// Sitemap: every publicly visible post's slug + last modification.
export async function findPublishedSlugs() {
  const { rows } = await query(
    `SELECT slug, updated_at FROM blog_posts WHERE ${PUBLIC_WHERE} ORDER BY published_at DESC`,
  );
  return rows;
}

export async function findAllPostsForAdmin({ status, search, page = 1, limit = 20 }) {
  const clauses = [];
  const params = [];
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(title ILIKE $${params.length} OR slug ILIKE $${params.length})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const { rows } = await query(
    `SELECT ${LIST_COLUMNS} FROM blog_posts ${where}
     ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  const {
    rows: [{ count }],
  } = await query(`SELECT COUNT(*)::int AS count FROM blog_posts ${where}`, params);
  return { items: rows, total: count };
}

export async function findPostById(id) {
  const { rows } = await query('SELECT * FROM blog_posts WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function findPostBySlug(slug) {
  const { rows } = await query('SELECT id, slug FROM blog_posts WHERE slug = $1', [slug]);
  return rows[0] ?? null;
}

const FIELD_COLUMNS = {
  title: 'title',
  slug: 'slug',
  excerpt: 'excerpt',
  coverImageUrl: 'cover_image_url',
  coverImageAlt: 'cover_image_alt',
  content: 'content',
  authorName: 'author_name',
  status: 'status',
  publishedAt: 'published_at',
  seoTitle: 'seo_title',
  seoDescription: 'seo_description',
};

export async function insertPost(fields, adminId) {
  const columns = ['created_by', 'updated_by'];
  const values = [adminId, adminId];
  for (const [key, column] of Object.entries(FIELD_COLUMNS)) {
    if (Object.hasOwn(fields, key)) {
      columns.push(column);
      values.push(fields[key]);
    }
  }
  const placeholders = values.map((_, i) => `$${i + 1}`);
  const { rows } = await query(
    `INSERT INTO blog_posts (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values,
  );
  return rows[0];
}

export async function updatePost(id, fields, adminId) {
  const sets = ['updated_by = $2', 'updated_at = now()'];
  const values = [id, adminId];
  for (const [key, column] of Object.entries(FIELD_COLUMNS)) {
    if (Object.hasOwn(fields, key)) {
      values.push(fields[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  const { rows } = await query(`UPDATE blog_posts SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, values);
  return rows[0] ?? null;
}

export async function deletePost(id) {
  await query('DELETE FROM blog_posts WHERE id = $1', [id]);
}
