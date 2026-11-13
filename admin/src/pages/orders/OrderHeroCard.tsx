import { useState } from 'react';
import type { OrderDetail } from '../../api/types';
import { formatPrice } from '../../utils/formatPrice';
import { formatOrderStatus } from '../../utils/orderStatus';
import { BoxIcon, PersonIcon, PhoneIcon, MailIcon, CalendarIcon, CopyIcon, PrinterIcon, DocumentIcon } from './OrderHeroIcons';
import styles from './OrderHeroCard.module.css';

// Compact-panel-only "Order Summary" card — the standalone full-page order
// view keeps its existing (denser, 3-pill) header. This card is deliberately
// just an at-a-glance summary; the delivery timeline lives in its own
// DeliveryStatusCard below, not in here.
export function OrderHeroCard({ order }: { order: OrderDetail }) {
  const [copied, setCopied] = useState(false);

  async function copyOrderId() {
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (permissions, insecure context) —
      // silently no-op rather than surface an error for a convenience action.
    }
  }

  return (
    <div className={styles.hero}>
      <div className={styles.topRow}>
        <div className={styles.orderIdGroup}>
          <span className={styles.orderIconCircle}>
            <BoxIcon size={20} />
          </span>
          <div>
            <p className={styles.label}>Order ID</p>
            <div className={styles.orderIdRow}>
              <span className={styles.orderId}>{order.orderNumber}</span>
              <button type="button" className={styles.copyButton} onClick={copyOrderId} title="Copy order ID" aria-label="Copy order ID">
                <CopyIcon />
              </button>
              {copied && <span className={styles.copiedHint}>Copied</span>}
            </div>
          </div>
        </div>
        <span className={`${styles.pill} ${order.paymentStatus === 'PAID' ? styles.pillSuccess : styles.pillNeutral}`}>
          Payment: {formatOrderStatus(order.paymentStatus)}
        </span>
      </div>

      <div className={styles.infoGrid}>
        <div className={styles.infoCol}>
          <p className={styles.infoRow}>
            <PersonIcon /> {order.contactName}
          </p>
          <p className={styles.infoRow}>
            <PhoneIcon /> {order.contactMobile}
          </p>
          <p className={styles.infoRow}>
            <MailIcon /> {order.contactEmail}
          </p>
        </div>
        <div className={styles.infoCol}>
          <p className={styles.infoRow}>
            <CalendarIcon /> Placed On
          </p>
          <p className={styles.placedDate}>
            {new Date(order.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })},{' '}
            {new Date(order.createdAt).toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </p>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.bottomRow}>
        <div className={styles.bottomLeft}>
          <span className={`${styles.pill} ${styles.pillInfo}`}>Shipment: {formatOrderStatus(order.shipmentStatus)}</span>
          <div className={styles.buttonRow}>
            {order.canPrintWorkOrder && (
              <a href={`/orders/${order.id}/work-order/print`} target="_blank" rel="noreferrer" className={styles.printButton}>
                <PrinterIcon />
                {order.workOrderPrintCount > 0 ? 'Reprint Work Order' : 'Print Work Order'}
              </a>
            )}
            {order.canPrintInvoice && (
              <a href={`/orders/${order.id}/invoice/print`} target="_blank" rel="noreferrer" className={styles.printButton}>
                <DocumentIcon size={14} />
                {order.invoicePrintCount > 0 ? 'Reprint Invoice' : 'Download Invoice'}
              </a>
            )}
          </div>
        </div>
        <div className={styles.bottomRight}>
          <p className={styles.totalLabel}>Total Amount</p>
          <p className={styles.total}>{formatPrice(order.totalAmount)}</p>
        </div>
      </div>
    </div>
  );
}
