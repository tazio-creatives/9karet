import { Link } from 'react-router-dom';
import { OrderDetailContent } from './OrderDetailContent';
import { ExternalLinkIcon } from './OrderHeroIcons';
import styles from './OrderDetailPanel.module.css';

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

// Slide-in side panel shown when an Orders list row is selected — reuses the
// exact same OrderDetailContent (items/status/shipment/tracking) the
// standalone /orders/:id page renders, so the two never drift.
export function OrderDetailPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  return (
    <aside className={styles.panel} aria-label="Order details">
      <div className={styles.header}>
        <p className={styles.title}>Order Details</p>
        <div className={styles.headerActions}>
          <Link to={`/orders/${orderId}`} className={styles.openFull} title="Open as full page">
            <ExternalLinkIcon />
            Open full page
          </Link>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close order details">
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className={styles.body}>
        <OrderDetailContent id={orderId} compact />
      </div>
    </aside>
  );
}
