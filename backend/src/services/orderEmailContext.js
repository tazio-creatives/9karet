// Builds the data an order-status email needs to render — reuses the exact
// same repository functions and toOrderDto/toShipmentDto shaping every
// other order surface (customer API, admin API) already uses, rather than
// re-deriving purity/gold-color/size/stone snapshot-fallback logic a
// second time. Templates only ever see this shape, never raw DB rows.
import { findOrderById, findOrderItems } from '../repositories/orders.repository.js';
import { findShipmentByOrderId } from '../repositories/shipments.repository.js';
import { toOrderDto, toShipmentDto } from '../utils/orderDto.js';
import { env } from '../config/env.js';

export async function buildOrderEmailContext(orderId) {
  if (!orderId) return null;
  const order = await findOrderById(orderId);
  if (!order) return null;

  const [items, shipment] = await Promise.all([findOrderItems(orderId), findShipmentByOrderId(orderId)]);
  const dto = toOrderDto(order, items, [], { shipment: toShipmentDto(shipment) });

  return {
    customerName: dto.contactName,
    orderNumber: dto.orderNumber,
    orderDate: dto.createdAt,
    orderStatus: dto.orderStatus,
    orderTotal: dto.totalAmount,
    items: dto.items.map((item) => ({
      productName: item.productName,
      productImageUrl: item.productImageUrl,
      purity: item.purity,
      goldColor: item.goldColor,
      sizeLabel: item.sizeLabel,
      stones: item.stones,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    deliveryAddress: dto.shippingAddress,
    deliveryEstimate: dto.deliveryEstimate,
    // Both null until a real shipment exists — the template must not show
    // an empty/placeholder AWB or courier before that's true.
    courierName: dto.shipment?.courierName ?? null,
    awbNumber: dto.shipment?.trackingNumber ?? null,
    // No separate public tracking-by-AWB page exists in this app — the
    // customer's own order detail page already shows live tracking (see
    // OrderDetails.tsx's Shipment Tracking section), so both the "View
    // Order" and "Track Your Order" CTAs point at the same URL.
    orderUrl: `${env.webAppBaseUrl}/account/orders/${order.id}`,
  };
}
