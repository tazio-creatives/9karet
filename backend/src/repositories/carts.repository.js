import { query } from '../config/db.js';

export async function findCartByOwner({ userId, guestSessionId }) {
  if (userId) {
    const { rows } = await query('SELECT * FROM carts WHERE user_id = $1', [userId]);
    return rows[0] ?? null;
  }
  const { rows } = await query('SELECT * FROM carts WHERE guest_session_id = $1', [guestSessionId]);
  return rows[0] ?? null;
}

export async function findCartByOwnerTx(client, { userId, guestSessionId }) {
  if (userId) {
    const { rows } = await client.query('SELECT * FROM carts WHERE user_id = $1', [userId]);
    return rows[0] ?? null;
  }
  const { rows } = await client.query('SELECT * FROM carts WHERE guest_session_id = $1', [guestSessionId]);
  return rows[0] ?? null;
}

// Called once payment is confirmed (paymentService.confirmPayment). Deletes
// only the cart_items rows matching this order's own line items — NOT a
// blanket "empty the cart" — because checkout's `items` payload is explicit
// rather than read from the cart server-side (see checkout.validators.js),
// which is exactly what lets "Buy Now" reuse this same endpoint without its
// single item ever having touched cart_items. A wholesale DELETE here would
// wipe unrelated items a Buy Now shopper still has sitting in their real
// cart; joining against this order's product_variant_id instead means a Buy
// Now purchase naturally matches zero rows and leaves the cart alone.
export async function clearOrderedItemsFromCartTx(client, cartId, orderId) {
  await client.query(
    `DELETE FROM cart_items ci
     USING order_items oi
     WHERE oi.order_id = $2
       AND ci.cart_id = $1
       AND ci.product_variant_id = oi.product_variant_id`,
    [cartId, orderId],
  );
}

export async function createCart({ userId, guestSessionId }) {
  const { rows } = await query(
    `INSERT INTO carts (user_id, guest_session_id) VALUES ($1, $2) RETURNING *`,
    [userId ?? null, userId ? null : guestSessionId],
  );
  return rows[0];
}

export async function findCartItems(cartId) {
  const { rows } = await query(
    `SELECT id, product_id, product_variant_id, quantity, created_at
     FROM cart_items WHERE cart_id = $1 ORDER BY created_at`,
    [cartId],
  );
  return rows;
}

// A cart line's identity is now just (cart, variant) — one non-nullable
// column instead of the old 4 independently-nullable axes — so a plain
// unique index (cart_items_variant_unique_idx) handles the upsert directly.
export async function upsertCartItemIncrement(cartId, productId, variantId, quantity) {
  const { rows } = await query(
    `INSERT INTO cart_items (cart_id, product_id, product_variant_id, quantity)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (cart_id, product_variant_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
     RETURNING *`,
    [cartId, productId, variantId, quantity],
  );
  return rows[0];
}

export async function setCartItemQuantity(cartId, variantId, quantity) {
  const { rows } = await query(
    `UPDATE cart_items SET quantity = $3
     WHERE cart_id = $1 AND product_variant_id = $2
     RETURNING *`,
    [cartId, variantId, quantity],
  );
  return rows[0] ?? null;
}

export async function removeCartItem(cartId, variantId) {
  await query('DELETE FROM cart_items WHERE cart_id = $1 AND product_variant_id = $2', [cartId, variantId]);
}

// Login-time reassignment (plan §11): a guest who never had an account yet
// just has their existing cart handed to the new user_id — no merge needed.
export async function reassignCartOwner(cartId, userId) {
  await query('UPDATE carts SET user_id = $2, guest_session_id = NULL WHERE id = $1', [
    cartId,
    userId,
  ]);
}

// Both carts already exist (returning customer with items left in a guest
// session) — dedupe by (product_variant_id), quantities add together, guest
// cart dropped once merged.
export async function mergeGuestCartIntoUserCart(guestCartId, userCartId) {
  await query(
    `INSERT INTO cart_items (cart_id, product_id, product_variant_id, quantity)
     SELECT $2, product_id, product_variant_id, quantity
     FROM cart_items WHERE cart_id = $1
     ON CONFLICT (cart_id, product_variant_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
    [guestCartId, userCartId],
  );
  await query('DELETE FROM carts WHERE id = $1', [guestCartId]);
}
