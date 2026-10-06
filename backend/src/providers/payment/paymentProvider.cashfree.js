// Real provider — Cashfree Payment Gateway. Credentials live only in
// backend env vars. Docs: https://docs.cashfree.com/reference/pg-new-apis-endpoint
import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const BASE_URLS = {
  SANDBOX: 'https://sandbox.cashfree.com',
  PRODUCTION: 'https://api.cashfree.com',
};

// Webhook signature deliberately rejects anything older than this, even a
// validly-signed one — narrows the replay window for a captured payload.
const WEBHOOK_MAX_AGE_SECONDS = 5 * 60;

// Event types Cashfree can send that this app doesn't act on (refunds,
// disputes, etc.) — parseWebhookEvent returns null for anything not in
// this set so confirmPayment() can 2xx them without confusion.
const HANDLED_EVENT_TYPES = new Set([
  'PAYMENT_SUCCESS_WEBHOOK',
  'PAYMENT_FAILED_WEBHOOK',
  'PAYMENT_USER_DROPPED_WEBHOOK',
]);

// The IDs an admin needs to find and refund a payment in the Cashfree
// dashboard — cf_payment_id is Cashfree's "Transaction ID".
function toPaymentDetails(payment) {
  if (!payment) return null;
  return {
    transactionId: payment.cf_payment_id != null ? String(payment.cf_payment_id) : null,
    bankReference: payment.bank_reference || null,
    paymentMethod: payment.payment_group || null,
    paymentStatus: payment.payment_status || null,
    paymentTime: payment.payment_time || payment.payment_completion_time || null,
    amount: payment.payment_amount ?? null,
  };
}

function baseUrl() {
  const url = BASE_URLS[env.cashfreeEnv];
  if (!url) throw new Error(`Unknown CASHFREE_ENV "${env.cashfreeEnv}"`);
  return url;
}

export const cashfreePaymentProvider = {
  name: 'cashfree',

  async createIntent(order) {
    const response = await fetch(`${baseUrl()}/pg/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': env.cashfreeAppId,
        'x-client-secret': env.cashfreeSecretKey,
        'x-api-version': env.cashfreeApiVersion,
      },
      body: JSON.stringify({
        order_id: order.order_number,
        // pg's NUMERIC(12,2) columns come back as strings — Cashfree's API
        // expects a JSON number, not a numeric string.
        order_amount: Number(order.total_amount),
        order_currency: 'INR',
        customer_details: {
          customer_id: order.user_id,
          customer_name: order.contact_name,
          customer_email: order.contact_email,
          customer_phone: order.contact_mobile,
        },
        order_meta: {
          return_url: `${env.webAppBaseUrl}/order-confirmation/${order.id}`,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Cashfree order creation failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    return {
      provider: 'cashfree',
      providerRef: order.order_number,
      status: 'PENDING',
      amount: order.total_amount,
      paymentSessionId: data.payment_session_id,
    };
  },

  // Cashfree signs `timestamp + rawBody` with the same secret key used for
  // API auth (no separate webhook secret) — base64 HMAC-SHA256, compared
  // against the x-webhook-signature header. x-webhook-timestamp also
  // guards against a captured payload being replayed indefinitely.
  verifySignature(rawBody, headers) {
    const signature = headers['x-webhook-signature'];
    const timestamp = headers['x-webhook-timestamp'];
    if (!signature || !timestamp) return false;

    // Cashfree sends x-webhook-timestamp in MILLISECONDS (a 13-digit epoch
    // value) — Date.now() is also milliseconds, so the diff must be
    // converted to seconds before comparing against WEBHOOK_MAX_AGE_SECONDS.
    // Comparing raw milliseconds against Date.now()/1000 (seconds) made
    // every real webhook look ~56 years old and silently reject every one.
    const age = Math.abs(Date.now() - Number(timestamp)) / 1000;
    if (!Number.isFinite(age) || age > WEBHOOK_MAX_AGE_SECONDS) return false;

    const expected = crypto
      .createHmac('sha256', env.cashfreeSecretKey)
      .update(timestamp + rawBody)
      .digest('base64');
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  },

  // Translates Cashfree's nested event envelope into the
  // {providerRef, status} shape paymentService.confirmPayment() works with.
  // Returns null for event types we don't act on (see HANDLED_EVENT_TYPES).
  parseWebhookEvent(rawBody) {
    const payload = JSON.parse(rawBody);
    if (!HANDLED_EVENT_TYPES.has(payload.type)) return null;

    const providerRef = payload.data?.order?.order_id;
    const cfStatus = payload.data?.payment?.payment_status;
    return {
      providerRef,
      status: cfStatus === 'SUCCESS' ? 'SUCCEEDED' : 'FAILED',
      details: toPaymentDetails(payload.data?.payment),
    };
  },

  // GET /pg/orders/{order_id}/payments — for orders paid before the webhook
  // started keeping these details. Picks the successful attempt (a shopper
  // can retry a failed method inside the same order).
  async fetchPaymentDetails(orderId) {
    const response = await fetch(`${baseUrl()}/pg/orders/${encodeURIComponent(orderId)}/payments`, {
      headers: {
        'x-client-id': env.cashfreeAppId,
        'x-client-secret': env.cashfreeSecretKey,
        'x-api-version': env.cashfreeApiVersion,
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      throw new Error(`Cashfree payments lookup failed (HTTP ${response.status})`);
    }
    const payments = await response.json();
    const list = Array.isArray(payments) ? payments : [];
    return toPaymentDetails(list.find((p) => p.payment_status === 'SUCCESS') ?? list[0]);
  },
};
