import type { Order, ShipmentTrackingEvent } from '../../api/types';
import { ReturnRequestSection } from './ReturnRequestSection';
import { CancelOrderSection, shouldShowCancelSection } from './CancelOrderSection';
import styles from './OrderSidebar.module.css';

function formatStatus(status: string) {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function milestoneAt(history: Order['statusHistory'], status: string): string | null {
  return history.find((h) => h.status === status)?.createdAt ?? null;
}

// Real, documented public tracking-page URL per courier — no such page
// exists for the dev-only 'stub' provider, so that (and any future
// provider not listed here) simply gets no link rather than a guessed one.
const COURIER_TRACKING_URL: Record<string, (_awb: string) => string> = {
  delhivery: (awb) => `https://www.delhivery.com/track/package/${awb}`,
  // Mirrors backend shippingProvider.bluedart.js's trackingUrl.
  bluedart: (awb) => `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${encodeURIComponent(awb)}`,
};

// Defensive display-layer dedup — a webhook delivery and the poll-based
// sync job can both record the same courier update; collapse consecutive
// identical (status, location, note) entries rather than showing it twice.
// Events are already chronological (backend orders them that way).
function dedupeEvents(events: ShipmentTrackingEvent[]) {
  return events.filter((event, i) => {
    if (i === 0) return true;
    const prev = events[i - 1];
    return !(prev.status === event.status && prev.location === event.location && prev.note === event.note);
  });
}

export function OrderSidebar({ order }: { order: Order }) {
  const deliveredAt = milestoneAt(order.statusHistory, 'DELIVERED');
  const trackingEvents = order.shipment ? dedupeEvents(order.shipment.trackingEvents) : [];

  return (
    <div className={styles.sidebar}>
      {/* Only shown once an AWB actually exists — before that there is
          nothing meaningful to track yet (spec: "Show tracking information
          only after an AWB exists"). */}
      {order.shipment?.trackingNumber && (
        <section className={styles.card}>
          <h2 className={styles.cardHeading}>Shipment Tracking</h2>
          <p className={styles.courierLine}>{order.shipment.courierName ?? order.shipment.provider}</p>
          <p className={styles.awbLine}>
            AWB: {order.shipment.trackingNumber}
            <span className={styles.statusPill}>{formatStatus(order.shipment.status)}</span>
          </p>

          {trackingEvents.length > 0 && (
            <ul className={styles.timeline}>
              {trackingEvents.map((event) => (
                <li key={event.id} className={styles.timelineItem}>
                  <span className={styles.timelineDot} aria-hidden="true" />
                  <div className={styles.timelineBody}>
                    <div className={styles.timelineRow}>
                      <span className={styles.timelineStatus}>{formatStatus(event.status)}</span>
                      <span className={styles.timelineDate}>{formatDateTime(event.createdAt)}</span>
                    </div>
                    {(event.location || event.note) && (
                      <p className={styles.timelineNote}>{[event.location, event.note].filter(Boolean).join(' — ')}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Deep-links to the courier's own real tracking page — only
              rendered when one is known for this shipment's provider (the
              dev-only 'stub' provider has no real tracking page). */}
          {COURIER_TRACKING_URL[order.shipment.provider] && (
            <a
              className={styles.trackLink}
              href={COURIER_TRACKING_URL[order.shipment.provider](order.shipment.trackingNumber)}
              target="_blank"
              rel="noreferrer"
            >
              Track shipment ↗
            </a>
          )}
        </section>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardHeading}>Order Timeline</h2>
        <ul className={styles.timeline}>
          {order.statusHistory.map((h, i) => (
            <li key={i} className={styles.timelineItem}>
              <span className={styles.timelineDot} aria-hidden="true" />
              <div className={styles.timelineBody}>
                <div className={styles.timelineRow}>
                  <span className={styles.timelineStatus}>{formatStatus(h.status)}</span>
                  <span className={styles.timelineDate}>{formatDateTime(h.createdAt)}</span>
                </div>
                {h.note && <p className={styles.timelineNote}>{h.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {shouldShowCancelSection(order) && (
        <section className={styles.card}>
          <h2 className={styles.cardHeading}>{order.orderStatus === 'CANCELLED' ? 'Refund' : 'Cancel Order'}</h2>
          <CancelOrderSection order={order} />
        </section>
      )}

      {/* Gated on "was ever delivered" (not "is currently DELIVERED") so a
          later status change (e.g. a return moving the order on to
          RETURN_INITIATED) doesn't make this card — and the ability to
          request/cancel a return — disappear. */}
      {deliveredAt && (
        <section className={styles.card}>
          <h2 className={styles.cardHeading}>Return Information</h2>
          <ReturnRequestSection
            orderId={order.id}
            deliveredAt={deliveredAt}
            nonReturnable={!!order.hasNonReturnableItems}
          />
        </section>
      )}
    </div>
  );
}
