import { query } from '../config/db.js';

export async function countProductImages(productId, type) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM product_images WHERE product_id = $1 AND type = $2',
    [productId, type],
  );
  return rows[0].count;
}

export async function insertProductImage({ productId, type, variant, format, url, isPrimary, sortOrder }) {
  const { rows } = await query(
    `INSERT INTO product_images (product_id, type, variant, format, url, is_primary, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [productId, type, variant, format, url, isPrimary ?? false, sortOrder ?? 0],
  );
  return rows[0];
}

export async function findProductImageById(id) {
  const { rows } = await query('SELECT * FROM product_images WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// All rows sharing the same upload (same variant set) — used to promote/
// demote/reorder/delete an image as one logical unit rather than per-format row.
export async function findProductImageSiblings(productId, sortOrder) {
  const { rows } = await query(
    'SELECT * FROM product_images WHERE product_id = $1 AND sort_order = $2',
    [productId, sortOrder],
  );
  return rows;
}

export async function clearPrimaryForProduct(productId) {
  await query('UPDATE product_images SET is_primary = false WHERE product_id = $1', [productId]);
}

export async function setPrimaryBySortOrder(productId, sortOrder) {
  await query('UPDATE product_images SET is_primary = (sort_order = $2) WHERE product_id = $1', [
    productId,
    sortOrder,
  ]);
}

export async function updateSortOrder(productId, oldSortOrder, newSortOrder) {
  await query(
    'UPDATE product_images SET sort_order = $3 WHERE product_id = $1 AND sort_order = $2',
    [productId, oldSortOrder, newSortOrder],
  );
}

// The one representative row for a specific group — same 'thumbnail'+'webp'
// convention as findAllImageGroups, used to preview a single photo (e.g. the
// Product Size Image) without pulling all 9 variant rows.
export async function findThumbnailBySortOrder(productId, sortOrder) {
  const { rows } = await query(
    `SELECT * FROM product_images WHERE product_id = $1 AND sort_order = $2 AND variant = 'thumbnail' AND format = 'webp'`,
    [productId, sortOrder],
  );
  return rows[0] ?? null;
}

export async function deleteProductImagesBySortOrder(productId, sortOrder) {
  const { rows } = await query(
    'DELETE FROM product_images WHERE product_id = $1 AND sort_order = $2 RETURNING url',
    [productId, sortOrder],
  );
  return rows;
}

// One representative row per (product, image) group — 'thumbnail'+'webp' is
// generated for every group by processAndStoreImage, so it's always present
// and cheap, unlike pulling every variant just to list a gallery grid.
export async function findAllImageGroups({ limit, offset, search, excludeProductId }) {
  const params = [];
  const conditions = [`pi.variant = 'thumbnail'`, `pi.format = 'webp'`];

  if (excludeProductId) {
    params.push(excludeProductId);
    conditions.push(`pi.product_id != $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`p.name ILIKE $${params.length}`);
  }

  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  const { rows } = await query(
    `SELECT pi.product_id, pi.sort_order, pi.url AS thumb_url, pi.is_primary, p.name AS product_name
     FROM product_images pi
     JOIN products p ON p.id = pi.product_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY pi.created_at DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );
  return rows;
}

export async function findMaxSortOrder(productId) {
  const { rows } = await query(
    'SELECT COALESCE(MAX(sort_order), -1) AS max FROM product_images WHERE product_id = $1',
    [productId],
  );
  return rows[0].max;
}
