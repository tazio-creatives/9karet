import { AppError, NotFoundError } from '../utils/AppError.js';
import { findProductById, findProductsByIds } from '../repositories/products.repository.js';
import { findVariantById, findVariantsByProductId, resolvedSizeLabel } from '../repositories/productVariants.repository.js';
import { computeVariantPricing } from './pricingService.js';
import { loadActiveRuleSet } from './pricingRuleResolver.js';
import { calculateDeliveryEstimate } from './deliveryEstimateService.js';
import {
  findCartByOwner,
  createCart,
  findCartItems,
  upsertCartItemIncrement,
  setCartItemQuantity,
  removeCartItem,
  reassignCartOwner,
  mergeGuestCartIntoUserCart,
} from '../repositories/carts.repository.js';

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Mirrors addCartItemSchema/updateCartItemSchema's per-request cap — that
// only bounds one request's delta, so a repeated increment (upsertCartItemIncrement
// adds onto the existing stored quantity) still needs its own ceiling.
const MAX_LINE_QUANTITY = 20;

async function findOrCreateCart(owner) {
  const existing = await findCartByOwner(owner);
  if (existing) return existing;
  return createCart(owner);
}

function toItemDto(item, product, variant, pricing) {
  const sellingPrice = pricing.sellingPrice;
  const lineTotal = round2(sellingPrice * item.quantity);
  // Same split used at checkout (checkoutService.js) — the tax portion
  // already baked into selling_price, backed out per line so the cart can
  // show a real GST-exclusive subtotal without guessing a flat rate.
  const lineGoldValue = round2(pricing.goldValue * item.quantity);
  const lineDiamondValue = round2(pricing.diamondValue * item.quantity);
  const lineMakingCharge = round2(pricing.makingCharge * item.quantity);
  const lineGst = round2(lineTotal - lineGoldValue - lineDiamondValue - lineMakingCharge);
  // A variant's real availability is its own stock, not the product-level
  // rollup (which sums every variant together).
  const availableStock = variant.stock_quantity;
  const sizeLabel = resolvedSizeLabel(variant);
  return {
    productId: product.id,
    variantId: variant.id,
    name: product.name,
    slug: product.slug,
    // sku/categoryName feed the storefront's GA4 add_to_cart dataLayer event
    // (item_id / item_category) — display-agnostic, not used by cart UI.
    sku: product.sku ?? null,
    categorySlug: product.category_slug,
    categoryName: product.category_name ?? null,
    primaryImageUrl: product.primary_image_url,
    metalType: product.metal_type,
    purity: pricing.purity,
    goldColor: pricing.goldColor,
    productSize: product.product_size ?? null,
    sizeLabel,
    diamondConfigId: pricing.diamondConfigId,
    diamondConfigName: variant.attributes?.diamond_quality?.label ?? null,
    sellingPrice,
    // Display-only — same pre-offer figure PDP/PLP/home already expose
    // (computeVariantPricing -> applyProductOffer), so the cart row can
    // show a "was" price without duplicating the discount math here.
    sellingPriceOriginal: pricing.sellingPriceOriginal,
    mrp: product.mrp != null ? Number(product.mrp) : 0,
    availableStock,
    quantity: item.quantity,
    lineTotal,
    lineGst,
    // Display-time truth only — stock can move between add-to-cart and
    // checkout, and this doesn't block anything either way: a line that
    // exceeds availableStock is fulfilled as Make to Order (checkoutService)
    // rather than rejected.
    isBackordered: item.quantity > availableStock,
  };
}

export async function getCart(owner) {
  const cart = await findOrCreateCart(owner);
  const items = await findCartItems(cart.id);
  // Live, not stored — the cart isn't an order yet, so this is recalculated
  // from "today" on every fetch (see checkoutService.createOrder for where
  // it's frozen into a permanent snapshot once an order actually exists).
  const deliveryEstimate = calculateDeliveryEstimate();
  if (items.length === 0) return { items: [], subtotal: 0, gstAmount: 0, itemCount: 0, deliveryEstimate };

  const products = await findProductsByIds(items.map((i) => i.product_id));
  const productMap = new Map(products.map((p) => [p.id, p]));
  // Loaded once for the whole cart (cached 30s inside loadActiveRuleSet
  // itself, so this is cheap even so) — every line must resolve through the
  // same active Pricing Rules the PLP/PDP already show, or the cart total
  // would silently diverge from the price the shopper was quoted.
  const ruleSet = await loadActiveRuleSet();

  const enriched = (
    await Promise.all(
      items.map(async (item) => {
        const product = productMap.get(item.product_id);
        const variant = await findVariantById(item.product_variant_id);
        if (!product || !variant) return null; // stale line (product/variant since removed) — quietly dropped from display
        const pricing = await computeVariantPricing(product, variant.combination_key === '' ? null : variant, null, null, ruleSet);
        return toItemDto(item, product, variant, pricing);
      }),
    )
  ).filter(Boolean);

  const subtotal = round2(enriched.reduce((sum, i) => sum + i.lineTotal, 0));
  const gstAmount = round2(enriched.reduce((sum, i) => sum + i.lineGst, 0));
  const itemCount = enriched.reduce((sum, i) => sum + i.quantity, 0);

  return {
    items: enriched.map(({ lineGst, ...rest }) => rest),
    subtotal,
    gstAmount,
    itemCount,
    deliveryEstimate,
  };
}

export async function addItem(owner, { productId, variantId, quantity }) {
  const product = await findProductById(productId);
  if (!product || product.status !== 'PUBLISHED') throw new NotFoundError('Product not found');

  const variants = await findVariantsByProductId(productId);
  if (variants.length > 1 && !variantId) {
    // More than the synthetic default variant exists — a specific
    // combination must be chosen.
    throw new AppError(400, 'Please select all product options');
  }
  const variant = variantId
    ? variants.find((v) => v.id === variantId)
    : variants.find((v) => v.combination_key === '');
  if (!variant) throw new AppError(400, 'Selected combination is not available for this product');
  if (!variant.is_available) throw new AppError(409, 'Selected combination is no longer available');

  // Out-of-stock no longer blocks adding to cart — it becomes Make to
  // Order, enforced/flagged for display in toItemDto and at checkout
  // (checkoutService), not here. Still capped at a fixed ceiling (not
  // availableStock) so repeated increments can't grow a line unbounded.
  const cart = await findOrCreateCart(owner);
  let item = await upsertCartItemIncrement(cart.id, productId, variant.id, quantity);
  if (item.quantity > MAX_LINE_QUANTITY) {
    item = await setCartItemQuantity(cart.id, variant.id, MAX_LINE_QUANTITY);
  }
  return getCart(owner);
}

export async function updateItemQuantity(owner, variantId, quantity) {
  const cart = await findOrCreateCart(owner);
  if (quantity <= 0) {
    await removeCartItem(cart.id, variantId);
    return getCart(owner);
  }

  const variant = await findVariantById(variantId);
  if (!variant) throw new NotFoundError('Product not found');

  const updated = await setCartItemQuantity(cart.id, variantId, quantity);
  if (!updated) throw new NotFoundError('Item not in cart');
  return getCart(owner);
}

export async function removeItem(owner, variantId) {
  const cart = await findOrCreateCart(owner);
  await removeCartItem(cart.id, variantId);
  return getCart(owner);
}

// Fired from the OTP verify LOGIN/SIGNUP path (plan §11) — folds whatever
// was in the guest cart_session cookie's cart into the now-identified
// user's cart, deduping by product_variant_id.
export async function mergeCartsOnLogin(guestSessionId, userId) {
  if (!guestSessionId) return;
  const guestCart = await findCartByOwner({ guestSessionId });
  if (!guestCart) return;

  const userCart = await findCartByOwner({ userId });
  if (!userCart) {
    await reassignCartOwner(guestCart.id, userId);
    return;
  }

  await mergeGuestCartIntoUserCart(guestCart.id, userCart.id);
}
