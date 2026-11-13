import crypto from 'node:crypto';
import { env } from '../../config/env.js';

// Dev/test provider — no real courier. Mirrors the shape
// shippingProvider.delhivery.js implements (see that file for what each
// method's real-world contract is) so shippingService.js never has to
// branch on which provider is active.
export const stubShippingProvider = {
  name: 'stub',
  displayName: 'Stub (dev only)',
  trackingSource: 'SYSTEM',

  isConfigured() {
    return true;
  },

  async checkServiceability() {
    return { serviceable: true };
  },

  async createShipment() {
    return {
      waybill: `STUB${Date.now()}`,
      courierName: 'Stub Express',
      labelUrl: null,
    };
  },

  async cancelShipment() {
    return { status: 'CANCELLED' };
  },

  async createReversePickup() {
    return {
      waybill: `STUBRVP${Date.now()}`,
      courierName: 'Stub Express',
    };
  },

  async fetchLabel() {
    return { labelUrl: null };
  },

  // No real courier to poll — status only ever changes here via the
  // admin "simulate tracking" dev shortcut (confirmTrackingUpdate), so a
  // scheduled sync finds nothing new to report.
  async trackShipment(waybill, currentStatus) {
    return { status: currentStatus, raw: null };
  },

  signPayload(payload) {
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', env.shippingWebhookSecret).update(body).digest('hex');
    return { body, signature };
  },

  verifySignature(rawBody, signature) {
    if (!signature) return false;
    const expected = crypto.createHmac('sha256', env.shippingWebhookSecret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  },
};
