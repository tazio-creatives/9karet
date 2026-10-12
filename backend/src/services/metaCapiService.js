import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { findOrderById, findOrderItems } from '../repositories/orders.repository.js';

// Meta Conversions API — server-side Purchase events, sent when the payment
// webhook confirms an order (never on the browser's word). Uses the same
// event_id as the browser Pixel's Purchase (`order_<id>`, see web
// analytics/metaPixel.ts) so Meta counts each order once.
//
// Customer details are SHA-256 hashed after normalising, as Meta requires;
// the browser identifiers (fbp/fbc/IP/user agent) were captured at checkout
// (orders.meta_attribution) and are sent as-is, per Meta's spec.

const GRAPH_VERSION = 'v21.0';

export function isMetaCapiEnabled() {
  return !!(env.metaPixelId && env.metaCapiAccessToken);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Normalised + hashed, or undefined when empty (Meta rejects empty hashes).
function hashed(value, normalise = (v) => v.trim().toLowerCase()) {
  if (value == null) return undefined;
  const v = normalise(String(value));
  return v ? [sha256(v)] : undefined;
}

// Indian mobile → digits with country code, e.g. 919876543210.
function normalisePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

const lettersOnly = (v) => v.trim().toLowerCase().replace(/[^a-z]/g, '');

// Pure: order + items + attribution → one Conversions API event.
export function buildPurchaseEvent(order, items) {
  const attribution = order.meta_attribution ?? {};
  const address = order.shipping_address ?? {};
  const [firstName, ...rest] = String(order.contact_name ?? address.name ?? '').trim().split(/\s+/);
  const lastName = rest.join(' ');

  const userData = {
    em: hashed(order.contact_email),
    ph: hashed(order.contact_mobile ?? address.mobileNumber, normalisePhone),
    fn: hashed(firstName, lettersOnly),
    ln: hashed(lastName, lettersOnly),
    ct: hashed(address.city, lettersOnly),
    st: hashed(address.state, lettersOnly),
    zp: hashed(address.pincode, (v) => v.replace(/\s/g, '')),
    country: hashed('in'),
    external_id: hashed(order.user_id),
    client_ip_address: attribution.ip || undefined,
    client_user_agent: attribution.userAgent || undefined,
    fbp: attribution.fbp || undefined,
    fbc: attribution.fbc || undefined,
  };
  for (const key of Object.keys(userData)) if (userData[key] === undefined) delete userData[key];

  const contents = items.map((i) => ({
    id: i.product_sku || i.product_id,
    quantity: i.quantity,
    item_price: Number(i.unit_price),
  }));

  return {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: `order_${order.id}`,
    action_source: 'website',
    event_source_url: attribution.sourceUrl || 'https://boxdiamonds.com/checkout',
    user_data: userData,
    custom_data: {
      currency: 'INR',
      value: Number(order.total_amount),
      order_id: order.order_number,
      content_type: 'product',
      content_ids: contents.map((c) => c.id),
      contents,
      num_items: contents.reduce((n, c) => n + c.quantity, 0),
    },
  };
}

// Throws on a failed request so the job queue retries it.
export async function sendPurchaseEvent(orderId) {
  if (!isMetaCapiEnabled()) return { skipped: 'not configured' };
  const order = await findOrderById(orderId);
  if (!order || order.payment_status !== 'PAID') return { skipped: 'order not paid' };
  const items = await findOrderItems(orderId);

  const body = { data: [buildPurchaseEvent(order, items)] };
  if (env.metaCapiTestCode) body.test_event_code = env.metaCapiTestCode;

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${env.metaPixelId}/events?access_token=${encodeURIComponent(env.metaCapiAccessToken)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Never log the token; Meta's error message is safe to log.
    throw new Error(`Meta CAPI ${res.status}: ${json?.error?.message ?? 'request failed'}`);
  }
  return { eventsReceived: json.events_received, traceId: json.fbtrace_id };
}
