// Meta Pixel (Facebook / Instagram ads) — pixel 1119380757335568. The base
// code in index.html loads fbevents.js and calls fbq('init') only; every
// event, including PageView, is sent from here so that route changes in this
// single-page app each count as a page view (the stock snippet would only
// count the first load).

export const META_PIXEL_ID = '1119380757335568';

type Fbq = (..._args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

function fbq(...args: unknown[]) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return; // SSR / blocked by an ad blocker
  window.fbq(...args);
}

export interface PixelItem {
  id: string;
  quantity: number;
  price: number;
}

export function pixelPageView() {
  fbq('track', 'PageView');
}

export function pixelViewContent(item: { id: string; name: string; category?: string | null; price: number }) {
  fbq('track', 'ViewContent', {
    content_ids: [item.id],
    content_name: item.name,
    content_category: item.category ?? undefined,
    content_type: 'product',
    value: item.price,
    currency: 'INR',
  });
}

export function pixelSearch(term: string) {
  fbq('track', 'Search', { search_string: term });
}

export function pixelAddToCart(item: PixelItem & { name: string }) {
  fbq('track', 'AddToCart', {
    content_ids: [item.id],
    content_name: item.name,
    content_type: 'product',
    contents: [{ id: item.id, quantity: item.quantity, item_price: item.price }],
    value: Math.round(item.price * item.quantity * 100) / 100,
    currency: 'INR',
  });
}

export function pixelInitiateCheckout(items: PixelItem[], value: number) {
  fbq('track', 'InitiateCheckout', {
    content_ids: items.map((i) => i.id),
    content_type: 'product',
    contents: items.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
    num_items: items.reduce((n, i) => n + i.quantity, 0),
    value,
    currency: 'INR',
  });
}

// eventID = the order id, so Meta can de-duplicate it against a future
// server-side (Conversions API) Purchase for the same order.
export function pixelPurchase(orderId: string, items: PixelItem[], value: number) {
  fbq(
    'track',
    'Purchase',
    {
      content_ids: items.map((i) => i.id),
      content_type: 'product',
      contents: items.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
      num_items: items.reduce((n, i) => n + i.quantity, 0),
      value,
      currency: 'INR',
    },
    { eventID: `order_${orderId}` },
  );
}
