import type { OrderDetail } from '../../api/types';
import { formatPrice } from '../../utils/formatPrice';
import { ORDER_STATUS_BADGE_CLASS, PAYMENT_STATUS_BADGE_CLASS, SHIPMENT_STATUS_BADGE_CLASS, formatOrderStatus } from '../../utils/orderStatus';
import sharedStyles from '../../styles/shared.module.css';
import { DocumentIcon, PersonIcon, PhoneIcon, MailIcon, CalendarIcon, PrinterIcon } from './OrderHeroIcons';
import { PaymentDetails } from './PaymentDetails';
import styles from './OrderSummaryCard.module.css';

// Full-page-only Order Summary — the standalone /orders/:id view's wide top
// card. The compact panel keeps its own OrderHeroCard (different, narrower
// layout); this isn't a shared component because the two shapes genuinely
// diverge (horizontal contact row + right-aligned badge stack here vs. a
// 2-column grid there), not just a styling difference.
export function OrderSummaryCard({ order }: { order: OrderDetail }) {
  const paymentBadge = PAYMENT_STATUS_BADGE_CLASS[order.paymentStatus] ?? 'badgeNeutral';
  const orderBadge = order.orderStatus ? ORDER_STATUS_BADGE_CLASS[order.orderStatus] ?? 'badgeNeutral' : 'badgeWarning';
  const shipmentBadge = SHIPMENT_STATUS_BADGE_CLASS[order.shipmentStatus] ?? 'badgeNeutral';

  const printWorkOrderButton = order.canPrintWorkOrder ? (
    <a href={`/orders/${order.id}/work-order/print`} target="_blank" rel="noreferrer" className={styles.printButton}>
      <PrinterIcon />
      {order.workOrderPrintCount > 0 ? 'Reprint Work Order' : 'Print Work Order'}
    </a>
  ) : null;

  const printInvoiceButton = order.canPrintInvoice ? (
    <a href={`/orders/${order.id}/invoice/print`} target="_blank" rel="noreferrer" className={styles.printButton}>
      <DocumentIcon size={16} />
      {order.invoicePrintCount > 0 ? 'Reprint Invoice' : 'Download Invoice'}
    </a>
  ) : null;

  return (
    <div className={styles.summary}>
      <div className={styles.left}>
        <span className={styles.iconBox}>
          <DocumentIcon size={22} />
        </span>
        <div>
          <p className={styles.label}>Order</p>
          <p className={styles.orderId}>{order.orderNumber}</p>
          <div className={styles.contactRow}>
            <span className={styles.contactItem}>
              <PersonIcon /> {order.contactName}
            </span>
            <span className={styles.contactItem}>
              <PhoneIcon /> {order.contactMobile}
            </span>
            <span className={styles.contactItem}>
              <MailIcon /> {order.contactEmail}
            </span>
          </div>
          <p className={styles.placedRow}>
            <CalendarIcon /> Placed on{' '}
            {new Date(order.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })},{' '}
            {new Date(order.createdAt).toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </p>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.badgeRow}>
          <span className={sharedStyles[paymentBadge]}>Payment: {formatOrderStatus(order.paymentStatus)}</span>
          <span className={sharedStyles[orderBadge]}>{formatOrderStatus(order.orderStatus)}</span>
          <span className={sharedStyles[shipmentBadge]}>Shipment: {formatOrderStatus(order.shipmentStatus)}</span>
        </div>
        <p className={styles.totalLabel}>Total Amount</p>
        <p className={styles.total}>{formatPrice(order.totalAmount)}</p>
        <PaymentDetails order={order} />
        <div className={styles.buttonRow}>
          {printWorkOrderButton}
          {printInvoiceButton}
        </div>
      </div>
    </div>
  );
}
