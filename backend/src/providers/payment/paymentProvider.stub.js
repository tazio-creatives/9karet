import crypto from 'node:crypto';
import { env } from '../../config/env.js';

// Dev/test provider — no real gateway. A real provider (Razorpay/Cashfree/
// Stripe) would return a redirect/embed target from createIntent(); the
// stub's "gateway page" is simulated by the /payments/simulate endpoint
// (customer-triggered from the checkout UI, see paymentService.js), which
// builds a payload through signPayload() exactly like a real gateway's
// servers would, then feeds it through the same verifySignature() +
// confirmPayment() path a real webhook delivery uses — nothing about the
// verification/idempotency logic is bypassed for being a stub.
export const stubPaymentProvider = {
  name: 'stub',

  async createIntent(order) {
    return {
      provider: 'stub',
      providerRef: `stub_${crypto.randomUUID()}`,
      status: 'PENDING',
      amount: order.total_amount,
    };
  },

  signPayload(payload) {
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', env.paymentWebhookSecret).update(body).digest('hex');
    return { body, headers: { 'x-payment-signature': signature } };
  },

  verifySignature(rawBody, headers) {
    const signature = headers['x-payment-signature'];
    if (!signature) return false;
    const expected = crypto.createHmac('sha256', env.paymentWebhookSecret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  },

  // Stub's own payload IS already {providerRef, status} — no translation
  // needed, unlike a real provider's nested event envelope.
  parseWebhookEvent(rawBody) {
    return JSON.parse(rawBody);
  },
};
