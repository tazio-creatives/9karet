import { query } from '../config/db.js';

export async function findReviewByOrderItemId(orderItemId) {
  const { rows } = await query('SELECT * FROM reviews WHERE order_item_id = $1', [orderItemId]);
  return rows[0] ?? null;
}

// Used to annotate an order's items with whether they've already been
// reviewed (plan §11a "Write a Review" eligibility on the order page).
export async function findReviewedOrderItemIds(orderItemIds) {
  if (orderItemIds.length === 0) return [];
  const { rows } = await query('SELECT order_item_id FROM reviews WHERE order_item_id = ANY($1)', [
    orderItemIds,
  ]);
  return rows.map((r) => r.order_item_id);
}

// Full review rows (not just the id) for a batch of order items — lets the
// order-detail page show the customer's own review (and its moderation
// status) instead of just a boolean, so it doesn't disappear once submitted.
export async function findReviewsByOrderItemIds(orderItemIds) {
  if (orderItemIds.length === 0) return [];
  const { rows } = await query('SELECT * FROM reviews WHERE order_item_id = ANY($1)', [orderItemIds]);
  return rows;
}

export async function insertReviewTx(client, { productId, userId, orderItemId, rating, title, body, isVerifiedPurchase }) {
  const { rows } = await client.query(
    `INSERT INTO reviews (product_id, user_id, order_item_id, rating, title, body, is_verified_purchase, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING') RETURNING *`,
    [productId, userId, orderItemId, rating, title ?? null, body ?? null, isVerifiedPurchase ?? false],
  );
  return rows[0];
}

export async function insertReviewImagesTx(client, reviewId, imageUrls) {
  if (imageUrls.length === 0) return;
  const values = imageUrls.map((_, i) => `($1, $${i + 2}, $${i + 2 + imageUrls.length})`).join(', ');
  const orders = imageUrls.map((_, i) => i);
  await client.query(
    `INSERT INTO review_images (review_id, image_url, sort_order) VALUES ${values}`,
    [reviewId, ...imageUrls, ...orders],
  );
}

export async function deleteReviewImagesTx(client, reviewId) {
  const { rows } = await client.query('DELETE FROM review_images WHERE review_id = $1 RETURNING image_url', [
    reviewId,
  ]);
  return rows.map((r) => r.image_url);
}

export async function findImagesByReviewIds(reviewIds) {
  if (reviewIds.length === 0) return new Map();
  const { rows } = await query(
    'SELECT review_id, image_url FROM review_images WHERE review_id = ANY($1) ORDER BY sort_order ASC',
    [reviewIds],
  );
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.review_id)) map.set(row.review_id, []);
    map.get(row.review_id).push(row.image_url);
  }
  return map;
}

async function attachImages(items) {
  const imagesByReviewId = await findImagesByReviewIds(items.map((r) => r.id));
  return items.map((r) => ({ ...r, images: imagesByReviewId.get(r.id) ?? [] }));
}

export async function findApprovedReviewsByProduct(productId, { page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await query(
    `SELECT r.*, u.full_name FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = $1 AND r.status = 'APPROVED'
     ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
    [productId, limit, offset],
  );
  const {
    rows: [{ count }],
  } = await query(`SELECT COUNT(*)::int AS count FROM reviews WHERE product_id = $1 AND status = 'APPROVED'`, [
    productId,
  ]);
  return { items: await attachImages(rows), total: count };
}

export async function findReviewsForModeration({ status, page = 1, limit = 20 } = {}) {
  const clauses = [];
  const params = [];
  if (status) {
    params.push(status);
    clauses.push(`r.status = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const listParams = [...params, limit, offset];

  const { rows } = await query(
    `SELECT r.*, u.full_name, u.mobile_number, p.name AS product_name, p.slug AS product_slug
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN products p ON p.id = r.product_id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  const {
    rows: [{ count }],
  } = await query(`SELECT COUNT(*)::int AS count FROM reviews r ${where}`, params);
  return { items: await attachImages(rows), total: count };
}

export async function findReviewById(id) {
  const { rows } = await query('SELECT * FROM reviews WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Customer editing their own review's content — always resets to PENDING
// (changed content needs re-moderation), distinct from updateReviewStatusTx
// (admin approve/reject, content untouched).
export async function updateReviewContentTx(client, id, { rating, title, body }) {
  const { rows } = await client.query(
    `UPDATE reviews SET rating = $2, title = $3, body = $4, status = 'PENDING' WHERE id = $1 RETURNING *`,
    [id, rating, title ?? null, body ?? null],
  );
  return rows[0] ?? null;
}

export async function updateReviewStatusTx(client, id, status) {
  const { rows } = await client.query('UPDATE reviews SET status = $2 WHERE id = $1 RETURNING *', [
    id,
    status,
  ]);
  return rows[0];
}

// Denormalized aggregate (plan §3 "avoids a join/aggregate per listing row
// on the PLP") — recomputed from APPROVED reviews only, every time a
// review's status changes.
export async function recalculateProductRatingTx(client, productId) {
  const {
    rows: [{ avg, count }],
  } = await client.query(
    `SELECT COALESCE(AVG(rating), 0) AS avg, COUNT(*)::int AS count
     FROM reviews WHERE product_id = $1 AND status = 'APPROVED'`,
    [productId],
  );
  await client.query('UPDATE products SET rating_avg = $2, rating_count = $3 WHERE id = $1', [
    productId,
    Number(avg).toFixed(2),
    count,
  ]);
}
