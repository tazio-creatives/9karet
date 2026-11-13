import type { OrderDetail, OrderStatus } from '../../api/types';
import { CheckIcon, TruckIcon, BoxIcon } from './OrderHeroIcons';
import styles from './DeliveryStatusCard.module.css';

const STAGES: { label: string; historyStatus: OrderStatus; Icon: typeof CheckIcon }[] = [
  { label: 'Confirmed', historyStatus: 'CONFIRMED', Icon: CheckIcon },
  { label: 'Processing', historyStatus: 'PROCESSING', Icon: TruckIcon },
  { label: 'Ready to Ship', historyStatus: 'READY_TO_SHIP', Icon: BoxIcon },
  { label: 'Out for Delivery', historyStatus: 'OUT_FOR_DELIVERY', Icon: TruckIcon },
  { label: 'Delivered', historyStatus: 'DELIVERED', Icon: CheckIcon },
];

// This is a deliberately simplified 5-stage customer-facing view — the
// system also tracks Shipped/In Transit as their own real order_status
// values (see OrderProgressStepper on the customer web app, which shows
// all 7), but those two collapse into "between Ready to Ship and Out for
// Delivery" here rather than getting their own column.
function stageIndexForOrderStatus(status: OrderStatus | null): number {
  switch (status) {
    case 'CONFIRMED':
      return 0;
    case 'PROCESSING':
      return 1;
    case 'READY_TO_SHIP':
      return 2;
    case 'SHIPPED':
    case 'IN_TRANSIT':
    case 'OUT_FOR_DELIVERY':
      return 3;
    case 'DELIVERED':
      return 4;
    default:
      return -1;
  }
}

function formatShortDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function DeliveryStatusCard({ order }: { order: OrderDetail }) {
  const currentIndex = stageIndexForOrderStatus(order.orderStatus);
  if (currentIndex < 0) return null;

  const milestoneAt = (status: OrderStatus) => order.statusHistory.find((h) => h.status === status)?.createdAt ?? null;

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <span className={styles.iconCircle}>
          <TruckIcon size={16} />
        </span>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Delivery Status</h2>
          <p className={styles.subtitle}>Track the shipment progress for this order.</p>
        </div>
        <span className={styles.orderNumber}>{order.orderNumber}</span>
      </div>

      <div className={styles.stepper}>
        {STAGES.map((stage, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending';
          return (
            <div key={stage.label} className={styles.step}>
              <div className={styles.dotRow}>
                <span className={`${styles.dot} ${styles[`dot_${state}`]}`}>
                  {state === 'done' ? <CheckIcon size={14} /> : <stage.Icon size={14} />}
                </span>
                {i < STAGES.length - 1 && (
                  <span className={`${styles.connector} ${i < currentIndex ? styles.connectorFilled : ''}`} />
                )}
              </div>
              <p className={`${styles.stepLabel} ${state !== 'pending' ? styles.stepLabelActive : ''}`}>{stage.label}</p>
              <p className={styles.stepDate}>
                {state === 'pending' ? '—' : formatShortDate(milestoneAt(stage.historyStatus))}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
