import { Link } from 'react-router-dom';
import type { Order } from '../../api/types';
import { formatPrice } from '../../utils/formatPrice';
import { DeliveryEstimateDetail } from '../../components/DeliveryEstimate';
import { WriteReviewButton } from './WriteReviewButton';
import { OrderProgressStepper } from '../account/OrderProgressStepper';
import styles from './OrderDetails.module.css';

function formatStatus(status: string) {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// The full Order payload already carries the raw status-history log — no
// separate milestone endpoint needed, just the earliest timestamp per
// status (mirrors what the list page's batched query does server-side).
function milestoneAt(history: Order['statusHistory'], status: string): string | null {
  return history.find((h) => h.status === status)?.createdAt ?? null;
}

// Title Case, per this page's design — the shared component's default
// STEP_LABELS (used by the My Orders list page) keeps its own casing.
// Index 0 is a placeholder sliced off by hideOrderPlaced below (the
// component always expects an 8-item array in "Order placed" first).
const DETAIL_STEP_LABELS = [
  'Order placed',
  'Confirmed',
  'Processing',
  'Ready to Ship',
  'Shipped',
  'In Transit',
  'Out for Delivery',
  'Delivered',
];

const STEPPER_STATUSES = new Set([
  'CONFIRMED',
  'PROCESSING',
  'READY_TO_SHIP',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]);

const PAYMENT_STATUS_CLASS: Record<string, string> = {
  PENDING: 'badgePending',
  PAID: 'badgeGood',
  FAILED: 'badgeBad',
  REFUNDED: 'badgePending',
};

const ORDER_STATUS_CLASS: Record<string, string> = {
  CONFIRMED: 'badgeInfo',
  PROCESSING: 'badgeInfo',
  READY_TO_SHIP: 'badgeInfo',
  SHIPPED: 'badgeInfo',
  IN_TRANSIT: 'badgeInfo',
  OUT_FOR_DELIVERY: 'badgeInfo',
  DELIVERED: 'badgeGood',
  DELAYED: 'badgePending',
  DELIVERY_FAILED: 'badgeBad',
  RETURN_INITIATED: 'badgePending',
  RETURNED: 'badgeBad',
  CANCELLED: 'badgeBad',
};

// Same shared status pill used per-item ("current item status") — plain
// order-level status, since this system tracks one status per order, not
// per line item.
function ItemStatusPill({ order }: { order: Order }) {
  const deliveredAt = milestoneAt(order.statusHistory, 'DELIVERED');
  if (order.orderStatus === 'DELIVERED' && deliveredAt) {
    return (
      <span className={styles.itemStatusPill}>
        Delivered on {new Date(deliveredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
      </span>
    );
  }
  const label = order.orderStatus ? formatStatus(order.orderStatus) : formatStatus(order.paymentStatus === 'FAILED' ? 'Payment Failed' : 'Pending Payment');
  const cls = order.orderStatus ? ORDER_STATUS_CLASS[order.orderStatus] ?? 'badgePending' : 'badgePending';
  return <span className={`${styles.itemStatusPill} ${styles[cls]}`}>{label}</span>;
}

export function OrderDetails({ order }: { order: Order }) {
  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <Link to="/account/orders" className={styles.back}>
          ← Back to orders
        </Link>
        <div className={styles.summaryHeader}>
          <div>
            <h2 className={styles.orderNumber}>{order.orderNumber}</h2>
            <p className={styles.placedDate}>
              Placed {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
            </p>
          </div>
        </div>
        <div className={styles.badgeRow}>
          <span className={`${styles.badge} ${styles[PAYMENT_STATUS_CLASS[order.paymentStatus] ?? 'badgePending']}`}>
            Payment: {formatStatus(order.paymentStatus)}
          </span>
          <span
            className={`${styles.badge} ${
              styles[order.orderStatus ? ORDER_STATUS_CLASS[order.orderStatus] ?? 'badgePending' : 'badgePending']
            }`}
          >
            {formatStatus(order.orderStatus ?? 'Awaiting Payment')}
          </span>
        </div>

        {order.orderStatus !== null && STEPPER_STATUSES.has(order.orderStatus) && (
          <div className={styles.stepperWrap}>
            <OrderProgressStepper
              variant="teal"
              hideOrderPlaced
              labels={DETAIL_STEP_LABELS}
              createdAt={order.createdAt}
              confirmedAt={milestoneAt(order.statusHistory, 'CONFIRMED')}
              processingAt={milestoneAt(order.statusHistory, 'PROCESSING')}
              readyToShipAt={milestoneAt(order.statusHistory, 'READY_TO_SHIP')}
              shippedAt={milestoneAt(order.statusHistory, 'SHIPPED')}
              inTransitAt={milestoneAt(order.statusHistory, 'IN_TRANSIT')}
              outForDeliveryAt={milestoneAt(order.statusHistory, 'OUT_FOR_DELIVERY')}
              deliveredAt={milestoneAt(order.statusHistory, 'DELIVERED')}
            />
          </div>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardHeading}>Items ({order.items.length})</h2>
        <ul className={styles.itemList}>
          {order.items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.itemThumb}>
                {item.productImageUrl ? (
                  <img src={item.productImageUrl} alt="" className={styles.itemThumbImg} />
                ) : (
                  <span className={styles.itemThumbPlaceholder} aria-hidden="true" />
                )}
              </div>

              <div className={styles.itemBody}>
                <div className={styles.itemTop}>
                  <div className={styles.itemNameCol}>
                    <p className={styles.itemName}>
                      {item.productName}
                      {item.isBackordered && <span className={styles.backorderBadge}>Make to Order</span>}
                    </p>
                    <p className={styles.itemMeta}>
                      SKU {item.productSku} · Qty {item.quantity}
                    </p>
                  </div>
                  <p className={styles.itemPrice}>{formatPrice(item.lineTotal)}</p>
                </div>

                {(item.sizeLabel || item.goldColor || item.purity) && (
                  <div className={styles.itemAttrStrip}>
                    {item.sizeLabel && (
                      <span>
                        Size: <strong>{item.sizeLabel}</strong>
                      </span>
                    )}
                    {item.goldColor && (
                      <span>
                        Metal: <strong>{formatStatus(item.goldColor)}</strong>
                      </span>
                    )}
                    {item.purity && (
                      <span>
                        Purity: <strong>{item.purity}</strong>
                      </span>
                    )}
                  </div>
                )}

                <div className={styles.itemFooter}>
                  <ItemStatusPill order={order} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardHeading}>Price Details</h2>
        <div className={styles.priceRow}>
          <span>Subtotal</span>
          <span>{formatPrice(order.subtotal)}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className={styles.priceRow}>
            <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
            <span>-{formatPrice(order.discountAmount)}</span>
          </div>
        )}
        <div className={styles.priceRow}>
          <span>GST</span>
          <span>{formatPrice(order.gstAmount)}</span>
        </div>
        <div className={styles.priceRow}>
          <span>Shipping</span>
          <span>{order.shippingAmount > 0 ? formatPrice(order.shippingAmount) : 'Free'}</span>
        </div>
        <div className={styles.totalRow}>
          <span>Total</span>
          <span>{formatPrice(order.totalAmount)}</span>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardHeading}>Delivery Address</h2>
        <div className={styles.addressRow}>
          <p className={styles.address}>
            {order.shippingAddress.name}
            <br />
            {order.shippingAddress.addressLine}
            {order.shippingAddress.building ? `, ${order.shippingAddress.building}` : ''}
            <br />
            {order.shippingAddress.landmark && (
              <>
                {order.shippingAddress.landmark}
                <br />
              </>
            )}
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
            <br />
            {order.shippingAddress.mobileNumber}
          </p>
          {order.deliveryEstimate && (
            <div className={styles.estimatePanel}>
              <DeliveryEstimateDetail estimate={order.deliveryEstimate} />
            </div>
          )}
        </div>
      </section>

      {/* Only for items that are either already reviewed or currently
          reviewable — an order never delivered (or with nothing eligible)
          shows no empty review section. */}
      {order.items.some((item) => item.canReview || item.review) && (
        <section className={styles.card}>
          <h2 className={styles.cardHeading}>Product Review</h2>
          <ul className={styles.reviewList}>
            {order.items
              .filter((item) => item.canReview || item.review)
              .map((item) => (
                <li key={item.id} className={styles.reviewRow}>
                  <div className={styles.reviewRowThumb}>
                    {item.productImageUrl ? (
                      <img src={item.productImageUrl} alt="" className={styles.reviewRowThumbImg} />
                    ) : (
                      <span className={styles.itemThumbPlaceholder} aria-hidden="true" />
                    )}
                  </div>
                  <div className={styles.reviewRowBody}>
                    <p className={styles.reviewRowName}>{item.productName}</p>
                    <WriteReviewButton
                      productId={item.productId}
                      productName={item.productName}
                      orderItemId={item.id}
                      orderId={order.id}
                      canReview={item.canReview}
                      review={item.review}
                    />
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
