import { apiFetch } from './client';
import type { Shipment, ShipmentTrackingEvent } from './types';

export interface CreateShipmentInput {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  // Courier key from fetchShippingProviders(); omitted = server default.
  provider?: string;
}

export interface ShippingProviderOption {
  name: string;
  displayName: string;
}

// Couriers selectable when creating a shipment (only configured ones), plus
// which one to preselect.
export function fetchShippingProviders() {
  return apiFetch<{ providers: ShippingProviderOption[]; defaultProvider: string | null }>(
    '/admin/shipping/providers',
  );
}

// Books the shipment with the courier (AWB creation) — only valid once the
// order is already READY_TO_SHIP (see api/orders.ts's markReadyToShip for
// that earlier, separate pure status-change step).
export function createShipment(orderId: string, input: CreateShipmentInput) {
  return apiFetch<{ shipment: Shipment }>(`/admin/shipping/orders/${orderId}/create-shipment`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function cancelShipment(orderId: string) {
  return apiFetch<{ shipment: Shipment }>(`/admin/shipping/orders/${orderId}/cancel-shipment`, {
    method: 'POST',
  });
}

// Pulls the courier's current status for this order's shipment on demand,
// instead of waiting for the next scheduled sync run.
export function syncTracking(orderId: string) {
  return apiFetch<{ shipment: Shipment }>(`/admin/shipping/orders/${orderId}/sync-tracking`, {
    method: 'POST',
  });
}

// Dev-only — see backend shippingService.simulateTrackingUpdate.
export function simulateTracking(orderId: string, status: 'OUT_FOR_DELIVERY' | 'DELIVERED') {
  return apiFetch<{ shipment: Shipment }>(`/admin/shipping/orders/${orderId}/simulate-tracking`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export interface AddTrackingEventInput {
  status: string;
  location?: string;
  note?: string;
}

export function addTrackingEvent(orderId: string, input: AddTrackingEventInput) {
  return apiFetch<{ event: ShipmentTrackingEvent }>(`/admin/shipping/orders/${orderId}/tracking-events`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
