import { createShipmentSchema, simulateTrackingSchema, addTrackingEventSchema } from '../validators/shipping.validators.js';
import * as shippingService from '../services/shippingService.js';
import { toShipmentDto, toTrackingEventDto } from '../utils/orderDto.js';
import { availableShippingProviders, shippingProvider } from '../providers/shipping/index.js';

// Couriers selectable in admin's Create Shipment dialog — only configured
// ones — plus which to preselect (SHIPPING_PROVIDER, when it's available).
export async function listProviders(req, res, next) {
  try {
    const providers = availableShippingProviders().map((p) => ({ name: p.name, displayName: p.displayName }));
    const defaultProvider = providers.some((p) => p.name === shippingProvider.name)
      ? shippingProvider.name
      : (providers[0]?.name ?? null);
    res.json({ providers, defaultProvider });
  } catch (err) {
    next(err);
  }
}

// Books the shipment with the courier (AWB creation) — only reachable once
// the order is already sitting at READY_TO_SHIP (set separately via
// adminOrders.controller.js::markReadyToShip, a pure status change with no
// courier call).
export async function createShipment(req, res, next) {
  try {
    const body = createShipmentSchema.parse(req.body);
    const shipment = await shippingService.createShipmentForOrder(req.params.id, body, req.admin.id);
    res.status(201).json({ shipment: toShipmentDto(shipment) });
  } catch (err) {
    next(err);
  }
}

export async function cancelShipment(req, res, next) {
  try {
    const shipment = await shippingService.cancelShipmentForOrder(req.params.id, req.admin.id);
    res.json({ shipment: toShipmentDto(shipment) });
  } catch (err) {
    next(err);
  }
}

// On-demand refresh from the admin order page — syncs the one order's
// shipment against the courier immediately rather than waiting for the
// next scheduled tracking-sync run.
export async function syncTracking(req, res, next) {
  try {
    const shipment = await shippingService.syncOneShipmentTrackingForOrder(req.params.id);
    res.json({ shipment: toShipmentDto(shipment) });
  } catch (err) {
    next(err);
  }
}

// Dev-only — see shippingService.simulateTrackingUpdate. Meaningless
// against a real Delhivery shipment (SHIPPING_PROVIDER=delhivery); only
// exercises anything with the stub provider active.
export async function simulateTracking(req, res, next) {
  try {
    const { status } = simulateTrackingSchema.parse(req.body);
    const result = await shippingService.simulateTrackingUpdate(req.params.id, status);
    res.json({ shipment: toShipmentDto(result.shipment), alreadyProcessed: result.alreadyProcessed });
  } catch (err) {
    next(err);
  }
}

export async function addTrackingEvent(req, res, next) {
  try {
    const body = addTrackingEventSchema.parse(req.body);
    const event = await shippingService.addManualTrackingEvent(req.params.id, body);
    res.status(201).json({ event: toTrackingEventDto(event) });
  } catch (err) {
    next(err);
  }
}
