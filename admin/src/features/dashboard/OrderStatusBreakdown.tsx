import type { DashboardOrderStatusBreakdown } from '../../api/dashboard';
import styles from './OrderStatusBreakdown.module.css';

// Order lifecycle collapsed into 6 stages an admin actually scans for
// (backend already groups the raw 11-value status enum down to this same
// set — see dashboard.repository.js). Colors are a hand-picked, validated
// subset of the dataviz skill's default categorical ramp (order preserved
// from validation — see the redesign's own notes) rather than the app's
// 3-value semantic status palette (success/warning/danger), which doesn't
// have enough distinct roles for 6 categories.
const SEGMENTS: { key: keyof DashboardOrderStatusBreakdown; label: string; color: string }[] = [
  { key: 'pending_payment', label: 'Pending Payment', color: '#eda100' },
  { key: 'processing', label: 'Processing', color: '#2a78d6' },
  { key: 'shipped', label: 'Shipped', color: '#1baf7a' },
  { key: 'delivered', label: 'Delivered', color: '#008300' },
  { key: 'cancelled', label: 'Cancelled / Failed', color: '#e34948' },
  { key: 'returned', label: 'Returned / Refunded', color: '#4a3aa7' },
];

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function OrderStatusBreakdown({ data }: { data: DashboardOrderStatusBreakdown }) {
  const total = SEGMENTS.reduce((sum, s) => sum + (data[s.key] ?? 0), 0);

  if (total === 0) {
    return <p className={styles.empty}>No orders yet.</p>;
  }

  let cumulative = 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.donutWrap}>
        <svg viewBox="0 0 100 100" className={styles.donut} role="img" aria-label="Order status breakdown">
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth="12" />
          {SEGMENTS.map((segment) => {
            const count = data[segment.key] ?? 0;
            if (count === 0) return null;
            const fraction = count / total;
            const dash = fraction * CIRCUMFERENCE;
            // 2px surface gap between adjacent segments (dataviz skill mark
            // spec) so each wedge reads as its own shape, not a blended ring.
            const gap = 2;
            const offset = -(cumulative / total) * CIRCUMFERENCE;
            cumulative += count;
            return (
              <circle
                key={segment.key}
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth="12"
                strokeDasharray={`${Math.max(dash - gap, 0)} ${CIRCUMFERENCE - Math.max(dash - gap, 0)}`}
                strokeDashoffset={offset}
                transform="rotate(-90 50 50)"
              >
                <title>{`${segment.label}: ${count} (${Math.round(fraction * 100)}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div className={styles.donutCenter}>
          <p className={styles.donutTotal}>{total}</p>
          <p className={styles.donutTotalLabel}>Orders</p>
        </div>
      </div>

      <ul className={styles.legend}>
        {SEGMENTS.map((segment) => {
          const count = data[segment.key] ?? 0;
          return (
            <li key={segment.key} className={styles.legendRow}>
              <span className={styles.legendSwatch} style={{ background: segment.color }} aria-hidden="true" />
              <span className={styles.legendLabel}>{segment.label}</span>
              <span className={styles.legendCount}>{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
