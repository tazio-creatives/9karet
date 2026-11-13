import { stubShippingProvider } from './shippingProvider.stub.js';
import { delhiveryShippingProvider } from './shippingProvider.delhivery.js';
import { bluedartShippingProvider } from './shippingProvider.bluedart.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

export const shippingProviders = {
  stub: stubShippingProvider,
  delhivery: delhiveryShippingProvider,
  bluedart: bluedartShippingProvider,
};

// The default provider (SHIPPING_PROVIDER) — preselected in admin's Create
// Shipment dialog, and used for anything without a per-shipment choice
// (return reverse pickups). The tracking-sync job looks a shipment's
// provider up in shippingProviders directly instead, so a shipment created
// under one provider keeps being polled correctly even if SHIPPING_PROVIDER
// is later switched.
export const shippingProvider = shippingProviders[env.shippingProvider] ?? stubShippingProvider;

// Couriers an admin may pick when creating a shipment — only ones with
// credentials configured. The dev-only stub is offered outside production.
export function availableShippingProviders() {
  return Object.values(shippingProviders).filter((p) =>
    p.name === 'stub' ? env.nodeEnv !== 'production' : p.isConfigured(),
  );
}

// Resolves an admin's courier choice (or the default when none was sent),
// refusing anything that isn't currently selectable.
export function resolveShippingProvider(name) {
  if (!name) return shippingProvider;
  const provider = availableShippingProviders().find((p) => p.name === name);
  if (!provider) throw new AppError(400, `Courier "${name}" is not available`);
  return provider;
}
