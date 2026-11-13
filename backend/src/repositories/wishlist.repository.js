import { query } from '../config/db.js';

export async function findWishlistByOwner({ userId, guestSessionId }) {
  if (userId) {
    const { rows } = await query('SELECT * FROM wishlist WHERE user_id = $1', [userId]);
    return rows[0] ?? null;
  }
  const { rows } = await query('SELECT * FROM wishlist WHERE guest_session_id = $1', [
    guestSessionId,
  ]);
  return rows[0] ?? null;
}

export async function createWishlist({ userId, guestSessionId }) {
  const { rows } = await query(
    `INSERT INTO wishlist (user_id, guest_session_id) VALUES ($1, $2) RETURNING *`,
    [userId ?? null, userId ? null : guestSessionId],
  );
  return rows[0];
}

export async function findWishlistItems(wishlistId) {
  const { rows } = await query(
    `SELECT id, product_id, created_at FROM wishlist_items WHERE wishlist_id = $1 ORDER BY created_at`,
    [wishlistId],
  );
  return rows;
}

export async function addWishlistItem(wishlistId, productId) {
  await query(
    `INSERT INTO wishlist_items (wishlist_id, product_id) VALUES ($1, $2)
     ON CONFLICT (wishlist_id, product_id) DO NOTHING`,
    [wishlistId, productId],
  );
}

export async function removeWishlistItem(wishlistId, productId) {
  await query('DELETE FROM wishlist_items WHERE wishlist_id = $1 AND product_id = $2', [
    wishlistId,
    productId,
  ]);
}

export async function reassignWishlistOwner(wishlistId, userId) {
  await query('UPDATE wishlist SET user_id = $2, guest_session_id = NULL WHERE id = $1', [
    wishlistId,
    userId,
  ]);
}

export async function mergeGuestWishlistIntoUserWishlist(guestWishlistId, userWishlistId) {
  await query(
    `INSERT INTO wishlist_items (wishlist_id, product_id)
     SELECT $2, product_id FROM wishlist_items WHERE wishlist_id = $1
     ON CONFLICT (wishlist_id, product_id) DO NOTHING`,
    [guestWishlistId, userWishlistId],
  );
  await query('DELETE FROM wishlist WHERE id = $1', [guestWishlistId]);
}
