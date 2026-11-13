import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

// Blue Dart — second real courier (BLUEDART_* in env.js), selectable per
// shipment from admin's Create Shipment dialog. Same interface as
// shippingProvider.delhivery.js so shippingService.js never branches on the
// courier.
//
// SKELETON: wiring, configuration and the admin/tracking plumbing are in
// place, but the actual Blue Dart API Gateway calls are intentionally not
// implemented yet — their request/response field names are account-specific
// and must come from Blue Dart's own API documentation (plus a sandbox
// account to test against), not be guessed. Until then every API method
// fails loudly with a clear message instead of booking anything.
//
// To finish: login (JWT) -> waybill generation with pickup registration
// (createShipment) -> cancel waybill -> tracking (trackShipment +
// forwardStatusMap) -> pincode serviceability (checkServiceability).

function notImplemented(action) {
  return new AppError(
    501,
    `Blue Dart ${action} is not available yet — the Blue Dart integration is awaiting API documentation/credentials.`,
  );
}

export const bluedartShippingProvider = {
  name: 'bluedart',
  displayName: 'Blue Dart',
  // shipment_tracking_events/order_status_history `source` for courier-driven
  // updates (allowed by the 20261001000000 migration).
  trackingSource: 'BLUEDART',

  isConfigured() {
    return Boolean(env.bluedartClientId && env.bluedartLoginId);
  },

  // Customer-facing public tracking page for an AWB.
  trackingUrl(awb) {
    return `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${encodeURIComponent(awb)}`;
  },

  // Blue Dart's raw tracking status -> our SHIPMENT_STATUSES vocabulary.
  // Deliberately empty until the real status codes are confirmed from
  // Blue Dart's docs — an unmapped status is left alone by the sync job
  // (same "don't guess" rule as Delhivery's map in shippingService.js).
  forwardStatusMap: {},

  async checkServiceability() {
    throw notImplemented('pincode serviceability check');
  },

  async createShipment() {
    throw notImplemented('shipment creation');
  },

  async cancelShipment() {
    throw notImplemented('shipment cancellation');
  },

  async trackShipment() {
    throw notImplemented('tracking');
  },

  async createReversePickup() {
    throw new AppError(400, 'Return pickups use Delhivery — Blue Dart reverse pickup is not supported.');
  },
};
