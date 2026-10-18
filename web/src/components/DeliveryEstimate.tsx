import { formatDeliveryRange, deliveryFallbackDaysText, type DeliveryEstimate as DeliveryEstimateData } from '../utils/deliveryEstimate';
import styles from './DeliveryEstimate.module.css';

// Outline delivery-truck icon, ~14px — matches the stroke weight already
// used by other product-card icons (GemIcon/TagIcon in PlpProductCard).
// Decorative only: the adjacent text already says everything a screen
// reader needs, so this is aria-hidden.
function TruckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M2 7h11v10H2z" />
      <path d="M13 10h4l4 3v4h-8z" />
      <circle cx="6" cy="19" r="1.7" />
      <circle cx="17" cy="19" r="1.7" />
    </svg>
  );
}

interface DeliveryEstimateProps {
  estimate: DeliveryEstimateData | null | undefined;
}

interface DeliveryEstimateDetailProps extends DeliveryEstimateProps {
  // Drops the component's own top margin so it can sit on the same row as
  // adjacent text (e.g. PDP's "In Stock" line) instead of stacking below it.
  inline?: boolean;
}

interface DeliveryEstimateCompactProps extends DeliveryEstimateProps {
  // Renders a <span> instead of a <p> and drops the top margin, so this can
  // sit inline next to the stock status text on the same row (e.g. PLP
  // card's "In Stock" line) — a <p> can't nest inside another <p>/<span> row.
  inline?: boolean;
}

// PLP / PLP-shaped card usage: "Delivery by 17–19 Sep". No background, pill,
// border or shadow — plain inline icon + text (see .compact in the CSS
// module). Falls back to "Delivery in 8–10 days" if the API didn't return a
// usable estimate, rather than showing nothing or a broken date.
export function DeliveryEstimateCompact({ estimate, inline = false }: DeliveryEstimateCompactProps) {
  const range = formatDeliveryRange(estimate?.earliestDate, estimate?.latestDate, 'compact');
  const text = range ? `Delivery by ${range}` : `Delivery in ${deliveryFallbackDaysText(estimate)}`;
  if (inline) {
    return (
      <span className={styles.compactInline}>
        <TruckIcon />
        <span>{text}</span>
      </span>
    );
  }
  return (
    <p className={styles.compact}>
      <TruckIcon />
      <span>{text}</span>
    </p>
  );
}

// PDP usage: "Estimated delivery: 17–19 September". Same no-background rule;
// the date range is the only bit visually emphasised (bold + green), never
// conveyed by colour alone — the label text carries the full meaning either
// way for a screen reader.
export function DeliveryEstimateDetail({ estimate, inline = false }: DeliveryEstimateDetailProps) {
  const range = formatDeliveryRange(estimate?.earliestDate, estimate?.latestDate, 'full');
  return (
    <div className={inline ? styles.detailInline : styles.detail}>
      <TruckIcon />
      <span>
        {range ? (
          <>
            Estimated delivery: <strong>{range}</strong>
          </>
        ) : (
          `Estimated delivery in ${deliveryFallbackDaysText(estimate)}`
        )}
      </span>
    </div>
  );
}
