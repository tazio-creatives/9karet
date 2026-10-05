// Real provider — Delhivery. Credentials live only in backend env vars
// (DELHIVERY_API_TOKEN/DELHIVERY_BASE_URL/DELHIVERY_PICKUP_LOCATION).
//
// Request/response shapes below follow Delhivery's publicly documented
// Create Shipment / Pincode Serviceability / Track / Packing Slip / Cancel
// APIs. No live Delhivery account was available to verify against a real
// sandbox while building this — per the plan, this is built against the
// documented shapes now and should be smoke-tested against a real sandbox
// call (one pincode check + one shipment create) the first time real
// DELHIVERY_API_TOKEN/DELHIVERY_BASE_URL values are configured, before
// relying on it for real orders.
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

function authHeaders(extra = {}) {
  return {
    Authorization: `Token ${env.delhiveryApiToken}`,
    ...extra,
  };
}

// Courier-side failures are thrown as AppError so the admin sees the real
// reason. A plain Error becomes a 500, which production masks as "Internal
// server error" — that's how a non-serviceable pincode used to surface.
// The raw Delhivery response is still logged for debugging.
async function parseJsonResponse(response, label) {
  const text = await response.text();
  const hint =
    response.status === 401 || response.status === 403
      ? ' Delhivery refused our API credentials — check the DELHIVERY_API_TOKEN setting.'
      : ' Please try again in a few minutes.';
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error(`Delhivery ${label} returned a non-JSON response (${response.status}):`, text.slice(0, 500));
    throw new AppError(502, `Delhivery ${label} failed (HTTP ${response.status}).${hint}`);
  }
  if (!response.ok) {
    console.error(`Delhivery ${label} failed (${response.status}):`, text.slice(0, 500));
    throw new AppError(502, `Delhivery ${label} failed (HTTP ${response.status}).${hint}`);
  }
  return data;
}

// Turns Delhivery's rejection remark into a clear, actionable admin message.
// Delhivery phrases the common case as e.g. "Crashing while saving package
// due to exception '671541 is non serviceable pincode'. Package might have
// been partially saved."
function describeRejection(action, remark, pincode) {
  const text = String(remark || '').trim();
  const partial = /partially saved/i.test(text)
    ? ' Delhivery says the package may have been partially saved — check the Delhivery portal and cancel it there if it appears.'
    : '';
  if (/non[\s-]*serviceable|not\s+serviceable|unserviceable/i.test(text)) {
    const pin = text.match(/\b(\d{6})\b/)?.[1] ?? pincode;
    return `Delhivery cannot ${action} pincode ${pin} — this location is not serviceable by Delhivery. Use another courier for this order or contact Delhivery support.${partial}`;
  }
  if (/embargo/i.test(text)) {
    return `Delhivery has temporarily stopped service (embargo) to pincode ${pincode}. Try again later or use another courier.${partial}`;
  }
  if (/duplicate/i.test(text)) {
    return `Delhivery rejected this as a duplicate — a shipment for this order may already exist in the Delhivery portal. Delhivery said: "${text}"`;
  }
  return `Delhivery rejected this request: "${text || 'no reason given'}".${partial}`;
}

export const delhiveryShippingProvider = {
  name: 'delhivery',
  displayName: 'Delhivery',
  trackingSource: 'DELHIVERY',

  isConfigured() {
    return Boolean(env.delhiveryApiToken);
  },

  // GET /c/api/pin-codes/json/?filter_codes=<pin> — prepaid orders need
  // postal_code.pre_paid === 'Y' at the destination pincode.
  async checkServiceability(pincode) {
    const response = await fetch(`${env.delhiveryBaseUrl}/c/api/pin-codes/json/?filter_codes=${pincode}`, {
      headers: authHeaders(),
    });
    const data = await parseJsonResponse(response, 'pincode serviceability check');
    const code = data.delivery_codes?.[0]?.postal_code;
    // A pincode can be listed with pre_paid 'Y' yet carry an embargo /
    // non-serviceable remark — that combination is what let order BD0022
    // pass this check and then fail at booking.
    const remark = String(code?.remarks ?? code?.remark ?? '').trim();
    const blockedByRemark = /embargo|non[\s-]*serviceable|not\s+serviceable/i.test(remark);
    const serviceable = !!code && code.pre_paid === 'Y' && !blockedByRemark;
    let reason = null;
    if (!code) reason = 'Delhivery does not deliver to this pincode';
    else if (code.pre_paid !== 'Y') reason = 'Delhivery does not accept prepaid deliveries to this pincode';
    else if (blockedByRemark) reason = `Delhivery reports: ${remark}`;
    return { serviceable, reason, raw: data };
  },

  // POST /api/cmu/create.json — shipments[] + pickup_location, form-encoded
  // as format=json&data=<json>. Leaving "waybill" blank has Delhivery
  // auto-assign and return one in packages[0].waybill (no separate AWB
  // fetch call needed for the common case of one package per shipment).
  async createShipment({ order, items, packageDetails }) {
    const address = order.shipping_address;
    const productsDesc = items.map((i) => `${i.product_name} x${i.quantity}`).join(', ');
    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

    const shipment = {
      name: address.name,
      add: [address.addressLine, address.building, address.landmark].filter(Boolean).join(', '),
      pin: address.pincode,
      city: address.city,
      state: address.state,
      country: 'India',
      phone: address.mobileNumber,
      order: order.order_number,
      payment_mode: 'Prepaid',
      products_desc: productsDesc,
      cod_amount: '0',
      total_amount: String(order.total_amount),
      quantity: String(totalQuantity),
      waybill: '',
      shipment_width: String(packageDetails.widthCm),
      shipment_height: String(packageDetails.heightCm),
      shipment_length: String(packageDetails.lengthCm),
      weight: String(packageDetails.weightGrams),
      shipping_mode: 'Surface',
      address_type: 'home',
    };

    const body = new URLSearchParams({
      format: 'json',
      data: JSON.stringify({
        shipments: [shipment],
        pickup_location: { name: env.delhiveryPickupLocation },
      }),
    });

    const response = await fetch(`${env.delhiveryBaseUrl}/api/cmu/create.json`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      body,
    });
    const data = await parseJsonResponse(response, 'shipment creation');
    const pkg = data.packages?.[0];
    if (!pkg || pkg.status !== 'Success' || !pkg.waybill) {
      const reason = pkg?.remarks?.join?.('; ') ?? data.rmk ?? 'unknown error';
      console.error(`Delhivery rejected shipment creation for order ${order.order_number}:`, reason);
      throw new AppError(422, describeRejection('deliver to', reason, address.pincode));
    }

    return { waybill: pkg.waybill, courierName: 'Delhivery', labelUrl: null, raw: data };
  },

  // POST /api/cmu/create.json — same endpoint as createShipment, but
  // payment_mode: "Pickup" flips the shipment's direction: the top-level
  // consignee fields (name/add/pin/city/state/phone) become WHERE THE
  // COURIER PICKS UP FROM (the customer's own delivery address, since
  // that's where the item physically is), and the return_* fields become
  // WHERE IT GETS DELIVERED TO (our warehouse) — confirmed against
  // Delhivery's documented reverse-shipment payload shape.
  async createReversePickup({ order, returnRequest }) {
    if (!env.delhiveryReturnAddress || !env.delhiveryReturnPincode || !env.delhiveryReturnCity || !env.delhiveryReturnState || !env.delhiveryReturnPhone) {
      throw new AppError(
        503,
        'Reverse pickup is not configured — set DELHIVERY_RETURN_ADDRESS/PINCODE/CITY/STATE/PHONE in the server environment',
      );
    }

    const address = order.shipping_address;
    const shipment = {
      name: address.name,
      add: [address.addressLine, address.building, address.landmark].filter(Boolean).join(', '),
      pin: address.pincode,
      city: address.city,
      state: address.state,
      country: 'India',
      phone: address.mobileNumber,
      order: `${order.order_number}-RETURN`,
      payment_mode: 'Pickup',
      products_desc: `Return pickup for order ${order.order_number} (${returnRequest.reason})`,
      cod_amount: '0',
      total_amount: String(order.total_amount),
      quantity: '1',
      waybill: '',
      return_name: env.delhiveryReturnName,
      return_add: env.delhiveryReturnAddress,
      return_pin: env.delhiveryReturnPincode,
      return_city: env.delhiveryReturnCity,
      return_state: env.delhiveryReturnState,
      return_phone: env.delhiveryReturnPhone,
      return_country: 'India',
    };

    const body = new URLSearchParams({
      format: 'json',
      data: JSON.stringify({
        shipments: [shipment],
        pickup_location: { name: env.delhiveryPickupLocation },
      }),
    });

    const response = await fetch(`${env.delhiveryBaseUrl}/api/cmu/create.json`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      body,
    });
    const data = await parseJsonResponse(response, 'reverse pickup creation');
    const pkg = data.packages?.[0];
    if (!pkg || pkg.status !== 'Success' || !pkg.waybill) {
      const reason = pkg?.remarks?.join?.('; ') ?? data.rmk ?? 'unknown error';
      console.error(`Delhivery rejected reverse pickup creation for order ${order.order_number}:`, reason);
      throw new AppError(422, describeRejection('pick up from', reason, address.pincode));
    }

    return { waybill: pkg.waybill, courierName: 'Delhivery', raw: data };
  },

  // GET /api/p/packing_slip/?wbns=<waybill>&pdf=true — done as a follow-up
  // call rather than inline with createShipment so a transient failure here
  // never blocks the shipment (and order transition) from succeeding; the
  // admin UI can retry fetching the label independently.
  async fetchLabel(waybill) {
    const response = await fetch(`${env.delhiveryBaseUrl}/api/p/packing_slip/?wbns=${waybill}&pdf=true`, {
      headers: authHeaders(),
    });
    const data = await parseJsonResponse(response, 'label fetch');
    return { labelUrl: data.packages?.[0]?.pdf_download_link ?? null };
  },

  // POST /api/p/edit — { waybill, cancellation: "true" }. Confirmed live
  // against a real sandbox shipment: unlike every other endpoint here, this
  // one returns XML, not JSON — e.g.
  // <root><status>True</status><waybill>...</waybill><remark>Shipment has
  // been cancelled.</remark></root> — unrelated to the `format=json` param
  // createShipment sends, which this endpoint doesn't accept at all.
  async cancelShipment(waybill) {
    const response = await fetch(`${env.delhiveryBaseUrl}/api/p/edit`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ waybill, cancellation: 'true' }),
    });
    const text = await response.text();
    if (!response.ok) {
      console.error(`Delhivery shipment cancellation failed (${response.status}):`, text.slice(0, 500));
      throw new AppError(502, `Delhivery could not cancel AWB ${waybill} (HTTP ${response.status}). Please try again, or cancel it from the Delhivery portal.`);
    }

    const status = /<status>\s*true\s*<\/status>/i.test(text);
    const remark = text.match(/<remark>([\s\S]*?)<\/remark>/i)?.[1] ?? null;
    if (!status) {
      throw new AppError(
        422,
        `Delhivery would not cancel AWB ${waybill}: "${(remark ?? text.slice(0, 200)).trim()}". If the courier has already picked it up, it can no longer be cancelled.`,
      );
    }
    return { status: 'CANCELLED', remark, raw: text };
  },

  // GET /api/v1/packages/json/?waybill=<waybill> — polled by the
  // shipment-tracking-sync job (no inbound webhook from Delhivery). Returns
  // Delhivery's own raw status string; the job maps it onto our
  // SHIPMENT_STATUSES vocabulary (see shippingService.js#DELHIVERY_STATUS_MAP)
  // and leaves anything it doesn't recognize alone rather than guessing.
  async trackShipment(waybill) {
    const response = await fetch(`${env.delhiveryBaseUrl}/api/v1/packages/json/?waybill=${waybill}`, {
      headers: authHeaders(),
    });
    const data = await parseJsonResponse(response, 'tracking fetch');
    const shipmentData = data.ShipmentData?.[0]?.Shipment;
    if (!shipmentData) return { status: null, raw: data };
    return {
      status: shipmentData.Status?.Status ?? null,
      statusType: shipmentData.Status?.StatusType ?? null,
      instructions: shipmentData.Status?.Instructions ?? null,
      raw: data,
    };
  },
};
