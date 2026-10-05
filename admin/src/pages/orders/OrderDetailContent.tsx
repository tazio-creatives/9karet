import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  fetchAdminOrder,
  updateOrderStatus,
  startProcessing,
  markReadyToShip,
  updateReturnRequestStatus,
  createReversePickup,
  syncReversePickup,
  simulateReversePickup,
} from '../../api/orders';
import { createShipment, cancelShipment, syncTracking, simulateTracking, addTrackingEvent } from '../../api/shipping';
import type { OrderStatus, OrderItem } from '../../api/types';
import type { CreateShipmentInput } from '../../api/shipping';
import { formatPrice } from '../../utils/formatPrice';
import { ApiError } from '../../api/client';
import { formatOrderStatus } from '../../utils/orderStatus';
import { formatDeliveryRange, deliveryFallbackDaysText } from '../../utils/deliveryEstimate';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CreateShipmentDialog } from '../../components/CreateShipmentDialog';
import { OrderHeroCard } from './OrderHeroCard';
import { DeliveryStatusCard } from './DeliveryStatusCard';
import { ChangeStatusCard } from './ChangeStatusCard';
import { OrderSummaryCard } from './OrderSummaryCard';
import { ChangeStatusRow } from './ChangeStatusRow';
import { OrderTimelineCard } from './OrderTimelineCard';
import { ReturnRequestCard } from './ReturnRequestCard';
import { RefundPendingCard, isRefundPending } from './RefundPendingCard';
import { RestockCard } from './RestockCard';
import { CopyIcon, BoxIcon, LocationIcon, HistoryIcon, TruckIcon } from './OrderHeroIcons';
import sharedStyles from '../../styles/shared.module.css';
import styles from './OrderDetailPage.module.css';

function formatGrams(value: number | null): string | null {
  return value != null ? `${value.toFixed(3)} g` : null;
}

// Mirrors the storefront PDP's AttributesList.tsx exactly (same field
// labels/order) — a staff member checking an order item should see the
// same "Product Details" panel a customer saw on the product page.
function buildProductDetailRows(item: OrderItem): [string, string][] {
  const rows: [string, string][] = [
    ['SKU', item.productSku],
    ['Certification', 'IGI, GII, GIG'],
  ];

  const metalLabel = item.metalType === 'PLATINUM' ? 'Platinum' : item.metalType === 'GOLD' ? 'Gold' : null;
  const goldColorLabel = item.goldColor ? item.goldColor.charAt(0) + item.goldColor.slice(1).toLowerCase() : '';
  const metal = [item.purity, goldColorLabel, metalLabel].filter(Boolean).join(' ');
  if (metal) rows.push(['Metal', metal]);
  if (item.purity) rows.push(['Purity', item.purity]);

  const goldWeight = formatGrams(item.goldWeightGrams);
  if (goldWeight) rows.push(['Gold Weight', goldWeight]);
  const netWeight = formatGrams(item.netWeightGrams);
  if (netWeight) rows.push(['Net Weight', netWeight]);
  const diamondWeightGrams = formatGrams(item.diamondWeightGrams);
  if (diamondWeightGrams) rows.push(['Natural Diamond Weight', diamondWeightGrams]);
  const grossWeight = formatGrams(item.grossWeightGrams);
  if (grossWeight) rows.push(['Gross Weight', grossWeight]);
  if (item.diamondWeightCarats != null) rows.push(['Natural Diamond Carat', `${item.diamondWeightCarats.toFixed(3)} ct`]);
  if (item.diamondConfigName) rows.push(['Natural Diamond Quality', item.diamondConfigName]);
  if (item.diamondCount != null) rows.push(['Natural Diamond Count', String(item.diamondCount)]);
  if (item.diamondColour) rows.push(['Natural Diamond Colour', item.diamondColour]);
  if (item.diamondClarity) rows.push(['Natural Diamond Clarity', item.diamondClarity]);
  if (item.gemstone) rows.push(['Gemstone', item.gemstone]);

  return rows;
}

// Shared body used both by the standalone /orders/:id page (OrderDetailPage,
// a thin wrapper adding the "back to orders" link) and the Orders list's
// slide-in side panel (OrderDetailPanel, which adds a close button instead)
// — one place owns all the status/shipment/tracking mutations rather than
// two divergent copies.
export function OrderDetailContent({ id, compact = false }: { id: string; compact?: boolean }) {
  const queryClient = useQueryClient();

  const [statusDraft, setStatusDraft] = useState<OrderStatus | ''>('');
  const [statusNote, setStatusNote] = useState('');
  const [eventStatus, setEventStatus] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventNote, setEventNote] = useState('');
  const [confirmingCancelShipment, setConfirmingCancelShipment] = useState(false);
  const [showCreateShipmentDialog, setShowCreateShipmentDialog] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const [awbCopied, setAwbCopied] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => fetchAdminOrder(id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-order', id] });

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => updateOrderStatus(id, status, statusNote.trim() || undefined),
    onSuccess: () => {
      invalidate();
      setStatusDraft('');
      setStatusNote('');
    },
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not update order status.'),
  });

  const startProcessingMutation = useMutation({
    mutationFn: () => startProcessing(id),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not start processing.'),
  });

  const markReadyToShipMutation = useMutation({
    mutationFn: () => markReadyToShip(id),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not mark ready to ship.'),
  });

  const createShipmentMutation = useMutation({
    mutationFn: (input: CreateShipmentInput) => createShipment(id, input),
    onSuccess: () => {
      invalidate();
      setShowCreateShipmentDialog(false);
    },
  });

  const syncTrackingMutation = useMutation({
    mutationFn: () => syncTracking(id),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not refresh tracking.'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelShipment(id),
    onSuccess: () => {
      invalidate();
      setConfirmingCancelShipment(false);
    },
    onError: (err) => {
      window.alert(err instanceof ApiError ? err.message : 'Could not cancel shipment.');
      setConfirmingCancelShipment(false);
    },
  });

  const trackingMutation = useMutation({
    mutationFn: (status: 'OUT_FOR_DELIVERY' | 'DELIVERED') => simulateTracking(id, status),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not update tracking.'),
  });

  const returnRequestMutation = useMutation({
    mutationFn: (status: 'APPROVED' | 'REJECTED') => updateReturnRequestStatus(id, status),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not update return request.'),
  });

  const schedulePickupMutation = useMutation({
    mutationFn: () => createReversePickup(id),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not schedule reverse pickup.'),
  });

  const syncPickupMutation = useMutation({
    mutationFn: () => syncReversePickup(id),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not refresh pickup tracking.'),
  });

  const simulatePickupMutation = useMutation({
    mutationFn: (status: Parameters<typeof simulateReversePickup>[1]) => simulateReversePickup(id, status),
    onSuccess: invalidate,
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not simulate pickup update.'),
  });

  const eventMutation = useMutation({
    mutationFn: () =>
      addTrackingEvent(id, {
        status: eventStatus.trim(),
        location: eventLocation.trim() || undefined,
        note: eventNote.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setEventStatus('');
      setEventLocation('');
      setEventNote('');
    },
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Could not add tracking event.'),
  });

  if (isLoading) return <p>Loading…</p>;
  if (isError || !data) {
    return <p className={sharedStyles.empty}>Order not found.</p>;
  }

  const { order } = data;
  const deliveryRange = formatDeliveryRange(order.deliveryEstimate?.earliestDate, order.deliveryEstimate?.latestDate);
  const deliveryText = deliveryRange ?? `Estimated delivery in ${deliveryFallbackDaysText(order.deliveryEstimate)}`;

  async function copyDeliveryAddress() {
    const lines = [
      order.shippingAddress.name,
      [order.shippingAddress.addressLine, order.shippingAddress.building].filter(Boolean).join(', '),
      `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.pincode}`,
      order.shippingAddress.mobileNumber,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (permissions, insecure context) —
      // silently no-op rather than surface an error for a convenience action.
    }
  }

  async function copyAwb(awb: string) {
    try {
      await navigator.clipboard.writeText(awb);
      setAwbCopied(true);
      setTimeout(() => setAwbCopied(false), 1500);
    } catch {
      // Same convenience-only, no-op-on-failure reasoning as copyDeliveryAddress.
    }
  }

  return (
    <div className={compact ? styles.compact : undefined}>
      {compact ? (
        <div className={styles.compactStack}>
          <OrderHeroCard order={order} />
          <DeliveryStatusCard order={order} />
          <ChangeStatusCard
            order={order}
            statusDraft={statusDraft}
            setStatusDraft={setStatusDraft}
            statusNote={statusNote}
            setStatusNote={setStatusNote}
            statusMutation={statusMutation}
            startProcessingMutation={startProcessingMutation}
          />
        </div>
      ) : (
        <div className={styles.fullStack}>
          <OrderSummaryCard order={order} />
          <ChangeStatusRow
            order={order}
            statusDraft={statusDraft}
            setStatusDraft={setStatusDraft}
            statusNote={statusNote}
            setStatusNote={setStatusNote}
            statusMutation={statusMutation}
            startProcessingMutation={startProcessingMutation}
          />
        </div>
      )}

      {isRefundPending(order) && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <RefundPendingCard order={order} />
        </div>
      )}

      {order.canRestock && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <RestockCard order={order} />
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={sharedStyles.cardPadded}>
            <h2 className={styles.sectionHeadingIcon}>
              <BoxIcon size={16} /> Items ({order.items.length})
            </h2>
            {order.items.map((item) => {
              const variants = [item.sizeLabel, item.purity, item.goldColor, item.diamondConfigName].filter(
                (v): v is string => Boolean(v),
              );
              const detailRows = buildProductDetailRows(item);
              return (
                <div key={item.id} className={styles.itemRow}>
                  {item.productImageUrl ? (
                    <img
                      src={item.productImageUrl}
                      alt=""
                      className={styles.itemImage}
                      onMouseEnter={() => setPreviewImage(item.productImageLargeUrl ?? item.productImageUrl)}
                      onMouseLeave={() => setPreviewImage(null)}
                    />
                  ) : (
                    <span className={styles.itemImagePlaceholder} />
                  )}
                  <div className={styles.itemDetails}>
                    <p className={styles.itemName}>
                      {item.productName}
                      {item.isBackordered && (
                        <>
                          {' '}
                          <span className={sharedStyles.badgeWarning}>Make to Order</span>
                        </>
                      )}
                    </p>
                    <p className={styles.itemMeta}>
                      SKU {item.productSku} · Qty {item.quantity}
                    </p>
                    {variants.length > 0 && (
                      <div className={styles.itemVariants}>
                        {variants.map((v, i) => (
                          <span key={i} className={styles.variantChip}>
                            {v}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.customizationNote && (
                      <p className={styles.itemMeta}>Customization: {item.customizationNote}</p>
                    )}
                    {detailRows.length > 0 && (
                      <dl
                        className={
                          compact
                            ? styles.productDetailList
                            : `${styles.productDetailList} ${styles.productDetailListFull}`
                        }
                      >
                        <p className={styles.productDetailHeading}>
                          <BoxIcon size={13} /> Product Details
                        </p>
                        {detailRows.map(([label, value]) => (
                          <div key={label} className={styles.productDetailRow}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                  <p className={styles.itemPrice}>{formatPrice(item.lineTotal)}</p>
                </div>
              );
            })}
            {!compact && (
              <div className={styles.totalsBlock}>
                <p className={styles.pricingSummaryHeading}>
                  <BoxIcon size={13} /> Pricing Summary
                </p>
                <div className={styles.totalRow}>
                  <span>Subtotal</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className={styles.totalRow}>
                    <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                    <span>-{formatPrice(order.discountAmount)}</span>
                  </div>
                )}
                <div className={styles.totalRow}>
                  <span>GST</span>
                  <span>{formatPrice(order.gstAmount)}</span>
                </div>
                <div className={styles.totalRow}>
                  <span>Shipping</span>
                  <span>{order.shippingAmount > 0 ? formatPrice(order.shippingAmount) : 'Free'}</span>
                </div>
                <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                  <span>Total</span>
                  <span>{formatPrice(order.totalAmount)}</span>
                </div>
              </div>
            )}
          </section>

          <section className={sharedStyles.cardPadded}>
            <div className={styles.addressHeadingRow}>
              <h2 className={styles.sectionHeadingIcon}>
                <LocationIcon size={16} /> Delivery Address
              </h2>
              <button type="button" className={styles.copyAddressButton} onClick={copyDeliveryAddress}>
                <CopyIcon />
                {addressCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className={styles.subtext}>Estimated delivery: {deliveryText}</p>
            <p className={styles.address}>
              {order.shippingAddress.name}
              <br />
              {order.shippingAddress.addressLine}
              {order.shippingAddress.building ? `, ${order.shippingAddress.building}` : ''}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
              <br />
              {order.shippingAddress.mobileNumber}
            </p>
            {order.deliveryNote && (
              <>
                <h2 className={`${styles.sectionHeading} ${styles.sectionHeadingSpaced}`}>Delivery Note</h2>
                <p className={styles.address}>{order.deliveryNote}</p>
              </>
            )}
          </section>

          {order.returnRequest && (
            <ReturnRequestCard
              returnRequest={order.returnRequest}
              reversePickup={order.reversePickup}
              onApprove={() => returnRequestMutation.mutate('APPROVED')}
              onReject={() => returnRequestMutation.mutate('REJECTED')}
              isPending={returnRequestMutation.isPending}
              onSchedulePickup={() => schedulePickupMutation.mutate()}
              onSyncPickup={() => syncPickupMutation.mutate()}
              onSimulatePickup={(status) => simulatePickupMutation.mutate(status)}
              isPickupPending={
                schedulePickupMutation.isPending || syncPickupMutation.isPending || simulatePickupMutation.isPending
              }
            />
          )}

          {!compact && order.shipment && (
            <section className={sharedStyles.cardPadded}>
              <h2 className={styles.sectionHeadingIcon}>
                <HistoryIcon size={16} /> Shipment History
              </h2>
              <p className={styles.hint}>
                {order.shipment.provider === 'stub'
                  ? 'Logged manually for now — switch SHIPPING_PROVIDER to delhivery for real courier-driven updates.'
                  : 'Courier-driven updates (source "delhivery") appear here automatically; use this form only to log something the courier feed wouldn’t capture.'}
              </p>

              <form
                className={styles.eventForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (eventStatus.trim()) eventMutation.mutate();
                }}
              >
                <input
                  type="text"
                  className={styles.eventInput}
                  placeholder="Status (e.g. In Transit, Reached Hub)"
                  value={eventStatus}
                  onChange={(e) => setEventStatus(e.target.value)}
                />
                <input
                  type="text"
                  className={styles.eventInput}
                  placeholder="Location (optional)"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                />
                <input
                  type="text"
                  className={styles.eventInputWide}
                  placeholder="Note (optional)"
                  value={eventNote}
                  onChange={(e) => setEventNote(e.target.value)}
                />
                <button
                  type="submit"
                  className={sharedStyles.buttonPrimary}
                  disabled={!eventStatus.trim() || eventMutation.isPending}
                >
                  {eventMutation.isPending ? 'Adding…' : 'Add Update'}
                </button>
              </form>

              {order.shipment.trackingEvents.length === 0 && (
                <p className={sharedStyles.empty}>No tracking updates logged yet.</p>
              )}
              {order.shipment.trackingEvents.length > 0 && (
                <ol className={styles.timeline}>
                  {order.shipment.trackingEvents.map((event) => (
                    <li key={event.id} className={styles.timelineItem}>
                      <span className={styles.timelineDot} />
                      <div className={styles.timelineBody}>
                        <div className={styles.timelineTop}>
                          <span className={styles.timelineStatus}>{event.status}</span>
                          <span className={styles.timelineDate}>
                            {new Date(event.createdAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <p className={styles.timelineNote}>
                          {event.location && <span>{event.location}</span>}
                          {event.location && event.note && ' · '}
                          {event.note && <span>{event.note}</span>}
                          {(event.location || event.note) && ' · '}
                          <span className={styles.eventSource}>{event.source.toLowerCase()}</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>

        <aside className={styles.side}>
          <section className={sharedStyles.cardPadded}>
            <h2 className={styles.sectionHeadingIcon}>
              <TruckIcon size={16} /> Shipping
            </h2>

            {!order.shipment && order.orderStatus === 'PROCESSING' && (
              <>
                <p className={styles.subtext}>Order is being processed.</p>
                <button
                  type="button"
                  className={sharedStyles.buttonPrimary}
                  disabled={markReadyToShipMutation.isPending}
                  onClick={() => markReadyToShipMutation.mutate()}
                >
                  {markReadyToShipMutation.isPending ? 'Updating…' : 'Mark Ready to Ship'}
                </button>
              </>
            )}

            {!order.shipment && order.orderStatus === 'READY_TO_SHIP' && (
              <>
                <p className={styles.subtext}>No shipment created yet.</p>
                <button
                  type="button"
                  className={sharedStyles.buttonPrimary}
                  onClick={() => setShowCreateShipmentDialog(true)}
                >
                  Create Shipment
                </button>
              </>
            )}

            {!order.shipment && order.orderStatus !== 'PROCESSING' && order.orderStatus !== 'READY_TO_SHIP' && (
              <p className={styles.hint}>Order must be Processing to mark Ready to Ship.</p>
            )}

            {order.shipment && (
              <>
                <p className={styles.shipmentLine}>
                  {order.shipment.courierName ?? order.shipment.provider} —{' '}
                  <strong>{formatOrderStatus(order.shipment.status)}</strong>
                </p>
                {order.shipment.trackingNumber && (
                  <p className={styles.shipmentLine}>
                    AWB: {order.shipment.trackingNumber}{' '}
                    <button
                      type="button"
                      className={styles.inlineCopyButton}
                      onClick={() => copyAwb(order.shipment!.trackingNumber!)}
                      title="Copy AWB"
                      aria-label="Copy AWB"
                    >
                      <CopyIcon size={12} />
                    </button>
                    {awbCopied && <span className={styles.copiedHint}> Copied</span>}
                  </p>
                )}
                {order.shipment.packageWeightGrams != null && (
                  <p className={styles.shipmentLine}>
                    Package: {order.shipment.packageWeightGrams}g · {order.shipment.packageLengthCm}×
                    {order.shipment.packageWidthCm}×{order.shipment.packageHeightCm} cm
                  </p>
                )}
                {order.shipment.lastTrackedAt && (
                  <p className={styles.hint}>
                    Last synced{' '}
                    {new Date(order.shipment.lastTrackedAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                )}

                {order.shipment.status !== 'CANCELLED' &&
                  order.shipment.status !== 'DELIVERED' &&
                  order.shipment.status !== 'RETURNED' && (
                    <div className={styles.shipmentActions}>
                      {order.shipment.provider === 'stub' ? (
                        <>
                          <button
                            type="button"
                            className={sharedStyles.button}
                            disabled={trackingMutation.isPending || order.shipment.status === 'OUT_FOR_DELIVERY'}
                            onClick={() => trackingMutation.mutate('OUT_FOR_DELIVERY')}
                          >
                            Mark Out for Delivery
                          </button>
                          <button
                            type="button"
                            className={sharedStyles.button}
                            disabled={trackingMutation.isPending}
                            onClick={() => trackingMutation.mutate('DELIVERED')}
                          >
                            Mark Delivered
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={sharedStyles.button}
                          disabled={syncTrackingMutation.isPending}
                          onClick={() => syncTrackingMutation.mutate()}
                        >
                          {syncTrackingMutation.isPending ? 'Refreshing…' : 'Refresh Tracking'}
                        </button>
                      )}
                      <button
                        type="button"
                        className={sharedStyles.buttonDanger}
                        disabled={cancelMutation.isPending}
                        onClick={() => setConfirmingCancelShipment(true)}
                      >
                        Cancel Shipment
                      </button>
                    </div>
                  )}
                <p className={styles.infoBox}>
                  {order.shipment.provider === 'stub'
                    ? 'Stub courier provider — tracking buttons simulate what a real courier would report.'
                    : `Tracking syncs automatically every few minutes, or use Refresh Tracking to check now.`}
                </p>
              </>
            )}
          </section>

          {!compact && <OrderTimelineCard order={order} />}
        </aside>
      </div>

      {confirmingCancelShipment && (
        <ConfirmDialog
          title="Cancel shipment"
          message="Cancel this shipment? This cannot be undone."
          confirmLabel="Cancel Shipment"
          cancelLabel="Keep Shipment"
          isPending={cancelMutation.isPending}
          onConfirm={() => cancelMutation.mutate()}
          onCancel={() => setConfirmingCancelShipment(false)}
        />
      )}

      {showCreateShipmentDialog && (
        <CreateShipmentDialog
          isPending={createShipmentMutation.isPending}
          errorMessage={createShipmentMutation.error instanceof ApiError ? createShipmentMutation.error.message : null}
          onConfirm={(input) => createShipmentMutation.mutate(input)}
          onCancel={() => setShowCreateShipmentDialog(false)}
        />
      )}

      {previewImage && (
        <div className={styles.imagePreviewOverlay}>
          <img src={previewImage} alt="" className={styles.imagePreviewLarge} />
        </div>
      )}
    </div>
  );
}
