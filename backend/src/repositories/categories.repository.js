import { query } from '../config/db.js';

const ALL_COLUMNS = `id, parent_id, name, slug, description, image_url, is_active, is_non_returnable, sort_order, created_at, updated_at,
  banner_enabled, banner_eyebrow, banner_description, banner_image_url, banner_image_url_mobile,
  banner_alt_text, banner_text_color, banner_text_position, banner_focal_position`;

export async function listAllCategories({ activeOnly = false } = {}) {
  const { rows } = await query(
    `SELECT ${ALL_COLUMNS} FROM categories
     ${activeOnly ? 'WHERE is_active = true' : ''}
     ORDER BY sort_order, name`,
  );
  return rows;
}

export async function searchCategories(term, limit = 5) {
  const { rows } = await query(
    `SELECT ${ALL_COLUMNS} FROM categories
     WHERE is_active = true AND name ILIKE '%' || $1 || '%'
     ORDER BY name LIMIT $2`,
    [term, limit],
  );
  return rows;
}

export async function findCategoryBySlug(slug) {
  const { rows } = await query(`SELECT ${ALL_COLUMNS} FROM categories WHERE slug = $1`, [slug]);
  return rows[0] ?? null;
}

export async function findCategoryById(id) {
  const { rows } = await query(`SELECT ${ALL_COLUMNS} FROM categories WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

// This category's id plus every descendant id, via a recursive CTE — used to
// make a PLP category filter include subcategory products (plan §3: "Rings →
// Diamond Rings → Solitaire Rings").
export async function getCategoryAndDescendantIds(categoryId) {
  const { rows } = await query(
    `WITH RECURSIVE descendants AS (
       SELECT id FROM categories WHERE id = $1
       UNION ALL
       SELECT c.id FROM categories c
       JOIN descendants d ON c.parent_id = d.id
     )
     SELECT id FROM descendants`,
    [categoryId],
  );
  return rows.map((r) => r.id);
}

// This category's own slug plus every ancestor's slug, via a recursive CTE
// walking up parent_id — the inverse of getCategoryAndDescendantIds. Needed
// because a product page-cache invalidation (pageCacheInvalidation.js) has
// to bust every ancestor's PLP page too, not just the product's own direct
// category: /rings lists Diamond Rings products via descendant inclusion,
// so adding/editing a product under Diamond Rings must also invalidate
// /rings or its cached page silently keeps serving a stale product count.
export async function getCategoryAndAncestorSlugs(categoryId) {
  const { rows } = await query(
    `WITH RECURSIVE ancestors AS (
       SELECT id, slug, parent_id FROM categories WHERE id = $1
       UNION ALL
       SELECT c.id, c.slug, c.parent_id FROM categories c
       JOIN ancestors a ON c.id = a.parent_id
     )
     SELECT slug FROM ancestors`,
    [categoryId],
  );
  return rows.map((r) => r.slug);
}

// Same walk as getCategoryAndAncestorSlugs, but ids instead of slugs and
// explicitly ordered deepest (the category itself) to shallowest (root) —
// needed by pricingRuleResolver.js, which must check a product's own
// category for a matching Category-scope rule before falling back to each
// ancestor in turn. depth is tracked explicitly since a recursive CTE gives
// no ordering guarantee on its own.
export async function getCategoryAndAncestorIds(categoryId) {
  const { rows } = await query(
    `WITH RECURSIVE ancestors AS (
       SELECT id, parent_id, 0 AS depth FROM categories WHERE id = $1
       UNION ALL
       SELECT c.id, c.parent_id, a.depth + 1 FROM categories c
       JOIN ancestors a ON c.id = a.parent_id
     )
     SELECT id FROM ancestors ORDER BY depth`,
    [categoryId],
  );
  return rows.map((r) => r.id);
}

// True if `candidateAncestorId` is categoryId itself or one of its
// descendants — used to reject a parent_id update that would create a cycle.
export async function isSelfOrDescendant(categoryId, candidateAncestorId) {
  const descendantIds = await getCategoryAndDescendantIds(categoryId);
  return descendantIds.includes(candidateAncestorId);
}

export async function createCategory({
  parentId,
  name,
  slug,
  description,
  imageUrl,
  isActive,
  isNonReturnable,
  sortOrder,
  bannerEnabled,
  bannerEyebrow,
  bannerDescription,
  bannerImageUrl,
  bannerImageUrlMobile,
  bannerAltText,
  bannerTextColor,
  bannerTextPosition,
  bannerFocalPosition,
}) {
  const { rows } = await query(
    `INSERT INTO categories (
       parent_id, name, slug, description, image_url, is_active, sort_order,
       banner_enabled, banner_eyebrow, banner_description, banner_image_url, banner_image_url_mobile,
       banner_alt_text, banner_text_color, banner_text_position, banner_focal_position, is_non_returnable
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING ${ALL_COLUMNS}`,
    [
      parentId ?? null,
      name,
      slug,
      description ?? null,
      imageUrl ?? null,
      isActive ?? true,
      sortOrder ?? 0,
      bannerEnabled ?? false,
      bannerEyebrow ?? null,
      bannerDescription ?? null,
      bannerImageUrl ?? null,
      bannerImageUrlMobile ?? null,
      bannerAltText ?? null,
      bannerTextColor ?? 'LIGHT',
      bannerTextPosition ?? 'LEFT',
      bannerFocalPosition ?? 'CENTER',
      isNonReturnable ?? false,
    ],
  );
  return rows[0];
}

// Only columns actually present as keys on `fields` are updated — COALESCE
// against undefined-vs-null can't distinguish "not provided" from
// "explicitly cleared" (e.g. clearing parent_id back to top-level), since
// both collapse to SQL NULL once bound as a query parameter.
const CATEGORY_COLUMNS = {
  parentId: 'parent_id',
  name: 'name',
  slug: 'slug',
  description: 'description',
  imageUrl: 'image_url',
  isActive: 'is_active',
  isNonReturnable: 'is_non_returnable',
  sortOrder: 'sort_order',
  bannerEnabled: 'banner_enabled',
  bannerEyebrow: 'banner_eyebrow',
  bannerDescription: 'banner_description',
  bannerImageUrl: 'banner_image_url',
  bannerImageUrlMobile: 'banner_image_url_mobile',
  bannerAltText: 'banner_alt_text',
  bannerTextColor: 'banner_text_color',
  bannerTextPosition: 'banner_text_position',
  bannerFocalPosition: 'banner_focal_position',
};

export async function updateCategory(id, fields) {
  const values = [id];
  const setClauses = [];
  for (const [key, column] of Object.entries(CATEGORY_COLUMNS)) {
    if (Object.hasOwn(fields, key)) {
      values.push(fields[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }
  if (setClauses.length === 0) return findCategoryById(id);

  setClauses.push('updated_at = now()');
  const { rows } = await query(
    `UPDATE categories SET ${setClauses.join(', ')} WHERE id = $1 RETURNING ${ALL_COLUMNS}`,
    values,
  );
  return rows[0] ?? null;
}

export async function countProductsInCategory(id) {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM products WHERE category_id = $1', [id]);
  return rows[0].count;
}

export async function countChildCategories(id) {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM categories WHERE parent_id = $1', [id]);
  return rows[0].count;
}

export async function deleteCategory(id) {
  await query('DELETE FROM categories WHERE id = $1', [id]);
}
