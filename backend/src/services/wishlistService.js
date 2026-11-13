import { NotFoundError } from '../utils/AppError.js';
import { findProductById, findProductsByIds } from '../repositories/products.repository.js';
import { toListDto } from '../controllers/products.controller.js';
import { calculateDeliveryEstimate } from './deliveryEstimateService.js';
import {
  findWishlistByOwner,
  createWishlist,
  findWishlistItems,
  addWishlistItem,
  removeWishlistItem,
  reassignWishlistOwner,
  mergeGuestWishlistIntoUserWishlist,
} from '../repositories/wishlist.repository.js';

async function findOrCreateWishlist(owner) {
  const existing = await findWishlistByOwner(owner);
  if (existing) return existing;
  return createWishlist(owner);
}

// Reuses the exact same purity-rule-aware pricing/offer DTO as the PLP
// (findProductsByIds already selects the same LIST_COLUMNS toListDto reads)
// so a wishlist card shows the identical discount badge/strikethrough a
// shopper saw on the listing — this used to return bare sellingPrice/mrp
// only, silently dropping any discount.
function toItemDto(product, deliveryEstimate) {
  const card = toListDto(product, deliveryEstimate);
  return { productId: card.id, ...card };
}

export async function getWishlist(owner) {
  const wishlist = await findOrCreateWishlist(owner);
  const items = await findWishlistItems(wishlist.id);
  if (items.length === 0) return { items: [] };

  const products = await findProductsByIds(items.map((i) => i.product_id));
  const productMap = new Map(products.map((p) => [p.id, p]));
  const deliveryEstimate = calculateDeliveryEstimate();

  const enriched = items
    .map((item) => productMap.get(item.product_id))
    .filter(Boolean)
    .map((product) => toItemDto(product, deliveryEstimate));

  return { items: enriched };
}

export async function addItem(owner, productId) {
  const product = await findProductById(productId);
  if (!product || product.status !== 'PUBLISHED') throw new NotFoundError('Product not found');

  const wishlist = await findOrCreateWishlist(owner);
  await addWishlistItem(wishlist.id, productId);
  return getWishlist(owner);
}

export async function removeItem(owner, productId) {
  const wishlist = await findOrCreateWishlist(owner);
  await removeWishlistItem(wishlist.id, productId);
  return getWishlist(owner);
}

// Mirrors cartService.mergeCartsOnLogin — same login-time fold, no
// quantities to reconcile here, just a set union of product_ids.
export async function mergeWishlistsOnLogin(guestSessionId, userId) {
  if (!guestSessionId) return;
  const guestWishlist = await findWishlistByOwner({ guestSessionId });
  if (!guestWishlist) return;

  const userWishlist = await findWishlistByOwner({ userId });
  if (!userWishlist) {
    await reassignWishlistOwner(guestWishlist.id, userId);
    return;
  }

  await mergeGuestWishlistIntoUserWishlist(guestWishlist.id, userWishlist.id);
}
