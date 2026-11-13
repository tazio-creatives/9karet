import type { Cart, CartItem, Order } from '../api/types';
import { pixelAddToCart, pixelInitiateCheckout, pixelPurchase, type PixelItem } from './metaPixel';

// E-commerce events, sent to GA4 (G-YF4GE487RS) with gtag('event', …) — GA4
// is loaded directly via gtag.js in index.html, and the GTM container there
// has no tags, so a plain dataLayer.push({event, ecommerce}) would never
// reach GA4. Each event is also sent to the Meta Pixel (metaPixel.ts) with
// the same item ids and values.

type Gtag = (..._args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

function gaEvent(name: string, params: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return; // SSR / blocked
  window.gtag('event', name, params);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

// e.g. "9K / Yellow Gold / Size 12" — only the parts this line has.
function variantLabel(line: CartItem): string | undefined {
  const parts = [
    line.purity,
    line.goldColor ? `${titleCase(line.goldColor)} Gold` : null,
    line.sizeLabel ? `Size ${line.sizeLabel}` : line.productSize,
  ].filter((p): p is string => !!p && String(p).trim() !== '');
  return parts.length ? parts.join(' / ') : undefined;
}

// The line that was just added: matched by variant when the caller knows it;
// otherwise (a direct quick-add, where the backend picks the default variant)
// the product's line whose quantity went up compared with the cart before.
function findAddedLine(
  prevCart: Cart | undefined,
  nextCart: Cart,
  productId: string,
  variantId?: string | null,
) {
  if (variantId) {
    const exact = nextCart.items.find((i) => i.variantId === variantId);
    if (exact) return exact;
  }
  const candidates = nextCart.items.filter((i) => i.productId === productId);
  const grew = candidates.find((line) => {
    const before = prevCart?.items.find((p) => p.variantId === line.variantId)?.quantity ?? 0;
    return line.quantity > before;
  });
  return grew ?? candidates[0];
}

// Call ONLY from an add-to-cart success handler, with the cart the server
// returned — so the event never fires for a failed request, and price is the
// server's final unit selling price at the moment of adding.
export function trackAddToCart({
  prevCart,
  nextCart,
  productId,
  variantId,
  quantity,
}: {
  prevCart: Cart | undefined;
  nextCart: Cart;
  productId: string;
  variantId?: string | null;
  quantity: number;
}) {
  const line = findAddedLine(prevCart, nextCart, productId, variantId);
  if (!line) return;

  const price = line.sellingPrice;
  const value = Math.round(price * quantity * 100) / 100;

  gaEvent('add_to_cart', {
    currency: 'INR',
    value,
    items: [
      {
        item_id: line.sku || line.productId,
        item_name: line.name,
        item_category: line.categoryName ?? undefined,
        item_variant: variantLabel(line),
        price,
        quantity,
      },
    ],
  });
  pixelAddToCart({ id: line.sku || line.productId, name: line.name, price, quantity });
}

function cartLineItem(line: CartItem) {
  return {
    item_id: line.sku || line.productId,
    item_name: line.name,
    item_category: line.categoryName ?? undefined,
    item_variant: variantLabel(line),
    price: line.sellingPrice,
    quantity: line.quantity,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export interface CheckoutLine {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  variant?: string;
}

// Checkout page opened with something to buy — the cart, or a single
// Buy Now item (which skips the cart).
export function trackBeginCheckout(lines: CheckoutLine[]) {
  if (lines.length === 0) return;
  const items = lines.map((l) => ({
    item_id: l.id,
    item_name: l.name,
    item_category: l.category,
    item_variant: l.variant,
    price: l.price,
    quantity: l.quantity,
  }));
  const value = round2(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));
  gaEvent('begin_checkout', { currency: 'INR', value, items });
  pixelInitiateCheckout(
    lines.map((l): PixelItem => ({ id: l.id, quantity: l.quantity, price: l.price })),
    value,
  );
}

export function cartCheckoutLines(cart: Cart): CheckoutLine[] {
  return cart.items.map((line) => {
    const i = cartLineItem(line);
    return {
      id: i.item_id,
      name: i.item_name,
      price: i.price,
      quantity: i.quantity,
      category: i.item_category,
      variant: i.item_variant,
    };
  });
}

// Call only once the server reports the order as PAID (the payment webhook
// confirmed it) — never on the gateway's client-side success signal. Sent at
// most once per order per browser, so a refresh or revisit of the
// confirmation page doesn't count the sale twice.
export function trackPurchase(order: Order) {
  if (typeof window === 'undefined' || order.paymentStatus !== 'PAID') return;
  const key = `bd_purchase_tracked_${order.id}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, '1');
  } catch {
    // storage blocked: still send once for this page view
  }
  const items = order.items.map((i) => ({
    item_id: i.productSku || i.productId,
    item_name: i.productName,
    item_variant:
      [i.purity, i.goldColor, i.sizeLabel && `Size ${i.sizeLabel}`]
        .filter(Boolean)
        .join(' / ') || undefined,
    price: i.unitPrice,
    quantity: i.quantity,
  }));
  gaEvent('purchase', {
    transaction_id: order.orderNumber,
    currency: 'INR',
    value: order.totalAmount,
    items,
  });
  pixelPurchase(
    order.id,
    items.map((i): PixelItem => ({ id: i.item_id, quantity: i.quantity, price: i.price })),
    order.totalAmount,
  );
}
