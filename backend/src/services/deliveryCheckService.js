import { shippingProvider, shippingProviders } from '../providers/shipping/index.js';

// Customer-facing "can you deliver to my pincode?" check (PDP delivery
// checker + address form), plus the pincode's city/state so the address form
// can prefill them. Uses Delhivery whenever it's configured — even if
// SHIPPING_PROVIDER points elsewhere — since it's the only courier with a
// working serviceability API; otherwise the default provider (the stub
// locally, which says yes to everything).

const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 5000;
const LOOKUP_TIMEOUT_MS = 4000;

// pincode -> { result, expiresAt }. Serviceability rarely changes within a
// day, and shoppers re-check the same pincode across products — caching
// keeps us well inside Delhivery's API limits.
const cache = new Map();

function pickProvider() {
  const delhivery = shippingProviders.delhivery;
  return delhivery.isConfigured() ? delhivery : shippingProvider;
}

// City/state from India Post's public pincode directory — Delhivery's own
// district field is unreliable (400001 Mumbai comes back as "Raigarh").
// A pincode can span post offices in more than one district, so the most
// common district wins. Resolves { city: null, state: null } on any failure.
async function lookupLocation(pincode) {
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    const [data] = await response.json();
    const offices = data?.Status === 'Success' ? data.PostOffice ?? [] : [];
    if (!offices.length) return { city: null, state: null, ok: true };
    const counts = new Map();
    for (const office of offices) counts.set(office.District, (counts.get(office.District) ?? 0) + 1);
    const city = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return { city: city || null, state: offices[0].State || null, ok: true };
  } catch (err) {
    console.error(`Pincode location lookup failed for ${pincode}:`, err.message);
    return { city: null, state: null, ok: false };
  }
}

async function checkServiceable(pincode) {
  try {
    const check = await pickProvider().checkServiceability(pincode);
    return { serviceable: !!check.serviceable, ok: true };
  } catch (err) {
    console.error(`Pincode serviceability check failed for ${pincode}:`, err.message);
    return { serviceable: null, ok: false };
  }
}

export function isValidPincode(pincode) {
  return PINCODE_PATTERN.test(String(pincode ?? ''));
}

// Returns { pincode, serviceable, city, state }. serviceable is null when the
// courier couldn't be reached — the storefront then says it couldn't verify
// rather than wrongly telling the customer "no". city/state are null when
// unknown. Only fully successful lookups are cached.
export async function checkDeliveryPincode(pincode) {
  const hit = cache.get(pincode);
  if (hit && hit.expiresAt > Date.now()) return hit.result;

  const [delivery, location] = await Promise.all([checkServiceable(pincode), lookupLocation(pincode)]);
  const result = { pincode, serviceable: delivery.serviceable, city: location.city, state: location.state };

  if (delivery.ok && location.ok) {
    if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(pincode, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return result;
}
