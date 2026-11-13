import type { OrderDetail } from '../../api/types';
import { formatOrderStatus } from '../../utils/orderStatus';
import { CheckIcon } from './OrderHeroIcons';
import styles from './OrderTimelineCard.module.css';

// Full-page-only vertical timeline for the right column, directly below
// Shipping — every entry is, by definition, something that already
// happened (order_status_history only ever gets a row once a transition
// occurs), so every dot renders as "done"; only the most recent entry gets
// the distinct "current" styling to show where the order actually is now.
export function OrderTimelineCard({ order }: { order: OrderDetail }) {
  return (
    <section className={styles.card}>
      <h2 className={styles.title}>Order Timeline</h2>
      <ol className={styles.timeline}>
        {order.statusHistory.map((h, i) => {
          const isCurrent = i === order.statusHistory.length - 1;
          return (
            <li key={i} className={styles.item}>
              <div className={styles.dotColumn}>
                <span className={`${styles.dot} ${isCurrent ? styles.dotCurrent : styles.dotDone}`}>
                  <CheckIcon size={12} />
                </span>
                {i < order.statusHistory.length - 1 && <span className={styles.connector} />}
              </div>
              <div className={styles.body}>
                <div className={styles.top}>
                  <span className={styles.status}>{formatOrderStatus(h.status)}</span>
                  <span className={styles.date}>
                    {new Date(h.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                {h.note && <p className={styles.note}>{h.note}</p>}
                <p className={styles.note}>{h.actorName ? `by ${h.actorName}` : formatOrderStatus(h.source).toLowerCase()}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
