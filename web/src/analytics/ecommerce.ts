import type { Cart, CartItem } from '../api/types';

// GA4 e-commerce events for Google Tag Manager (container GTM-TS9FR3PF).
// Events are pushed to window.dataLayer only — GTM owns forwarding them to
// GA4 (G-YF4GE487RS); nothing here calls gtag() directly.

type DataLayerEntry = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: DataLayerEntry[];
  }
}

function pushToDataLayer(entry: DataLayerEntry) {
  if (typeof window === 'undefined') return; // SSR: no dataLayer on the server
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(entry);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

// e.g. "18K / Yellow Gold / Size 12 / VVS EF" — only the parts this line has.
function variantLabel(line: CartItem): string | undefined {
  const parts = [
    line.purity,
    line.goldColor ? `${titleCase(line.goldColor)} Gold` : null,
    line.sizeLabel ? `Size ${line.sizeLabel}` : line.productSize,
    line.diamondConfigName,
  ].filter((p): p is string => !!p && String(p).trim() !== '');
  return parts.length ? parts.join(' / ') : undefined;
}

// The line that was just added: matched by variant when the caller knows it;
// otherwise (a direct quick-add, where the backend picks the default variant)
// the product's line whose quantity went up compared with the cart before.
function findAddedLine(prevCart: Cart | undefined, nextCart: Cart, productId: string, variantId?: string | null) {
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

  // GA4 recommends clearing the previous ecommerce object first so values
  // from an earlier event never leak into this one.
  pushToDataLayer({ ecommerce: null });
  pushToDataLayer({
    event: 'add_to_cart',
    ecommerce: {
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
    },
  });
}
