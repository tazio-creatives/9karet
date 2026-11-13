import styles from './OrderProgressStepper.module.css';

interface OrderProgressStepperProps {
  createdAt: string;
  confirmedAt: string | null;
  processingAt: string | null;
  readyToShipAt: string | null;
  shippedAt: string | null;
  inTransitAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  // 'teal' is the Order Details page's own tracker styling — deep
  // teal/muted grey per that page's design, distinct from the My Orders
  // list page's burgundy stepper, which must stay exactly as it was.
  variant?: 'default' | 'teal';
  // The Order Details page tracker starts at "Confirmed" (per its design),
  // not "Order placed" — the list page keeps showing all 8 steps.
  hideOrderPlaced?: boolean;
  // Order Details uses Title Case ("Ready to Ship", "In Transit", "Out for
  // Delivery") — the list page keeps its existing STEP_LABELS casing below
  // untouched.
  labels?: string[];
}

const STEP_LABELS = [
  'Order placed',
  'Confirmed',
  'Processing',
  'Ready to ship',
  'Shipped',
  'In transit',
  'Out for delivery',
  'Delivered',
];

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Happy-path only — createdAt is always present the moment an order exists,
// so completedCount is always >= 1. Callers should not render this for
// terminal/exception states (Payment Pending/Failed, Delayed, Delivery
// Failed, Return Initiated, Returned, Cancelled) — an 8-step "on the way to
// delivery" tracker doesn't represent what happened there; the status badge
// already covers those.
export function OrderProgressStepper({
  createdAt,
  confirmedAt,
  processingAt,
  readyToShipAt,
  shippedAt,
  inTransitAt,
  outForDeliveryAt,
  deliveredAt,
  variant = 'default',
  hideOrderPlaced = false,
  labels: labelsProp,
}: OrderProgressStepperProps) {
  const allDates = [createdAt, confirmedAt, processingAt, readyToShipAt, shippedAt, inTransitAt, outForDeliveryAt, deliveredAt];
  const baseLabels = labelsProp ?? STEP_LABELS;
  const labels = hideOrderPlaced ? baseLabels.slice(1) : baseLabels;
  const dates = hideOrderPlaced ? allDates.slice(1) : allDates;
  const tealClass = variant === 'teal' ? styles.teal : '';

  return (
    <ol className={`${styles.stepper} ${tealClass}`} aria-label="Order progress">
      {labels.map((label, i) => {
        const date = dates[i];
        // Each step's own date decides its state — not a count of how many
        // dates are set overall. A courier can report a later stage (e.g.
        // Out for Delivery) without ever separately reporting an
        // intermediate one (e.g. In Transit), leaving a gap in the middle
        // of the dates array rather than a clean run from the start.
        const isComplete = Boolean(date);
        return (
          <li key={label} className={styles.stepWrap}>
            <div className={styles.dotRow}>
              <span className={`${styles.dot} ${isComplete ? styles.dotComplete : ''}`} aria-hidden="true" />
              {i < labels.length - 1 && (
                <span
                  className={`${styles.connector} ${isComplete ? styles.connectorComplete : ''}`}
                  aria-hidden="true"
                />
              )}
            </div>
            <span className={`${styles.label} ${isComplete ? styles.labelComplete : ''}`}>{label}</span>
            {date && <span className={styles.date}>{shortDate(date)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
