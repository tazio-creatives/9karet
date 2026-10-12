import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOrderById } from '../api/orders';
import { trackPurchase } from '../analytics/ecommerce';
import { formatPrice } from '../utils/formatPrice';
import { placeholderGradient } from '../utils/placeholderGradient';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { formatDeliveryRange, deliveryFallbackDaysText } from '../utils/deliveryEstimate';
import { OrderSuccessHeader } from '../features/orderConfirmation/OrderSuccessHeader';
import { SuccessIllustration } from '../features/orderConfirmation/SuccessIllustration';
import styles from './OrderConfirmationPage.module.css';

function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 9V3h12v6" />
      <rect x="4" y="9" width="16" height="8" rx="1.5" />
      <path d="M6 14h12v7H6z" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect x="3" y="13" width="4" height="6" rx="1.5" />
      <rect x="17" y="13" width="4" height="6" rx="1.5" />
      <path d="M19 19v1a2 2 0 0 1-2 2h-3" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" strokeLinecap="round" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function itemMetaLine(item: { purity: string | null; goldColor: string | null; sizeLabel: string | null; diamondConfigName: string | null }) {
  const parts: string[] = [];
  if (item.purity || item.goldColor) {
    const color = item.goldColor ? item.goldColor.charAt(0) + item.goldColor.slice(1).toLowerCase() : '';
    parts.push([item.purity, color].filter(Boolean).join(' '));
  }
  if (item.sizeLabel) parts.push(`Size ${item.sizeLabel}`);
  if (item.diamondConfigName) parts.push(item.diamondConfigName);
  return parts.join(' · ');
}


export function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrderById(orderId as string),
    enabled: !!orderId,
    // A real gateway (Cashfree) confirms the order asynchronously via a
    // server-to-server webhook, arriving some seconds after the customer
    // finishes on the checkout page — poll briefly so this page updates
    // itself instead of leaving the customer stuck on "Confirming..." until
    // they manually refresh.
    refetchInterval: (query) => (query.state.data?.order.paymentStatus === 'PENDING' ? 2000 : false),
  });

  useDocumentTitle(data ? `Order ${data.order.orderNumber}` : 'Order Confirmation');

  // Cart clearing happens server-side once payment is confirmed (see
  // backend paymentService.confirmPayment) — invalidate here, the one place
  // that's true for both the dev stub and the real Cashfree flow.
  useEffect(() => {
    if (data?.order.orderStatus === 'CONFIRMED') {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    }
  }, [data?.order.orderStatus, queryClient]);

  // GA4 purchase + Meta Pixel Purchase — only once the payment webhook has
  // marked the order PAID (this page polls until then); trackPurchase itself
  // makes sure each order is counted once.
  useEffect(() => {
    if (data?.order.paymentStatus === 'PAID') trackPurchase(data.order);
  }, [data?.order]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopyOrderId(orderNumber: string) {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
    } catch {
      // Clipboard API unavailable (older browser, non-secure context) —
      // silently no-op rather than throwing; the order ID is still
      // selectable/readable as plain text.
    }
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <OrderSuccessHeader />
        <main className={styles.container} aria-busy="true">
          <div className={styles.skeletonHero} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </main>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.page}>
        <OrderSuccessHeader />
        <main className={styles.container}>
          <div className={styles.notFound}>
            <h1 className={styles.notFoundHeading}>Order not found</h1>
            <p className={styles.notFoundBody}>We couldn&rsquo;t find that order.</p>
            <Link to="/" className={styles.textLink}>
              Back to Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { order } = data;

  // Success validation — order creation succeeded (we have data), payment
  // status is actually successful/paid, and this is confirmed order data,
  // not a guess. Anything short of that gets a distinct, much simpler
  // state below — never the premium success page, and never "Payment
  // Pending"/"Complete Payment"/a retry button on it.
  if (order.paymentStatus === 'PENDING') {
    return (
      <div className={styles.page}>
        <OrderSuccessHeader />
        <main className={styles.container}>
          <div className={styles.interstitial}>
            <span className={styles.interstitialIconPending}>
              <ClockIcon />
            </span>
            <h1 className={styles.interstitialHeading}>Confirming your payment…</h1>
            <p className={styles.interstitialBody}>
              This usually takes just a few seconds. This page will update itself automatically.
            </p>
            <Link to="/" className={styles.textLink}>
              Continue Shopping
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (order.paymentStatus === 'FAILED' || order.orderStatus === 'CANCELLED') {
    return (
      <div className={styles.page}>
        <OrderSuccessHeader />
        <main className={styles.container}>
          <div className={styles.interstitial}>
            <span className={styles.interstitialIconFailed}>
              <AlertIcon />
            </span>
            <h1 className={styles.interstitialHeading}>We couldn&rsquo;t confirm your payment</h1>
            <p className={styles.interstitialBody}>
              This order wasn&rsquo;t completed. If any amount was deducted, it will be refunded automatically.
            </p>
            <Link to="/cart" className={styles.textLink}>
              Return to Bag
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' });
  const orderDetailHref = `/account/orders/${order.id}`;
  const address = order.shippingAddress;
  const deliveryRange = formatDeliveryRange(order.deliveryEstimate?.earliestDate, order.deliveryEstimate?.latestDate);
  const deliveryText = deliveryRange ?? `In ${deliveryFallbackDaysText(order.deliveryEstimate)}`;

  return (
    <div className={styles.page}>
      <OrderSuccessHeader />

      <main className={styles.container}>
        <section className={styles.hero}>
          <SuccessIllustration />
          <h1 className={styles.heroHeading}>Order Confirmed!</h1>
          <p className={styles.heroSubtext}>
            Thank you, {order.contactName}. Your payment was successful.
          </p>
          <span className={styles.paymentBadge}>
            <CheckCircleIcon />
            Payment Successful
          </span>
          <p className={styles.heroConfirm}>Your order is confirmed and being prepared.</p>

          <div className={styles.heroActions}>
            <Link to={orderDetailHref} className={styles.primaryButton}>
              Track Order
            </Link>
            <Link to={orderDetailHref} className={styles.secondaryButton}>
              View Order Details
            </Link>
            <Link to="/" className={styles.textLink}>
              Continue Shopping
            </Link>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <h2 className={styles.cardHeading}>Order Summary</h2>
            <span className={styles.paidBadge}>Paid</span>
          </div>

          <div className={styles.orderMetaRow}>
            <div className={styles.orderMetaCol}>
              <p className={styles.metaLabel}>Order ID</p>
              <div className={styles.orderIdRow}>
                <span className={styles.orderIdValue}>{order.orderNumber}</span>
                <button
                  type="button"
                  className={styles.copyButton}
                  onClick={() => handleCopyOrderId(order.orderNumber)}
                  aria-label="Copy order ID"
                >
                  <CopyIcon />
                </button>
                {copied && (
                  <span className={styles.copiedTag} role="status">
                    Copied
                  </span>
                )}
              </div>
            </div>
            <div className={styles.orderMetaCol}>
              <p className={styles.metaLabel}>Order Date</p>
              <p className={styles.metaValue}>{orderDate}</p>
            </div>
            <div className={styles.orderMetaCol}>
              <p className={styles.metaLabel}>Estimated Delivery</p>
              <p className={styles.metaValue}>{deliveryText}</p>
            </div>
          </div>

          <button type="button" className={styles.printButton} onClick={() => window.print()}>
            <PrintIcon />
            Print / Download Invoice
          </button>

          <ul className={styles.itemList}>
            {order.items.map((item, i) => {
              const meta = itemMetaLine(item);
              return (
                <li key={item.id} className={styles.item}>
                  <div className={styles.itemThumb} style={{ background: placeholderGradient(i) }} />
                  <div className={styles.itemInfo}>
                    <p className={styles.itemName}>
                      {item.productName}
                      {item.isBackordered && <span className={styles.backorderBadge}>Make to Order</span>}
                    </p>
                    {meta && <p className={styles.itemMeta}>{meta}</p>}
                    <p className={styles.itemQty}>Qty: {item.quantity}</p>
                  </div>
                  <p className={styles.itemPrice}>{formatPrice(item.lineTotal)}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardHeading}>Delivery Address</h2>
          <p className={styles.addressName}>{address.name}</p>
          <p className={styles.addressLine}>
            {address.addressLine}
            {address.building ? `, ${address.building}` : ''}
          </p>
          <p className={styles.addressLine}>
            {address.city}, {address.state} - {address.pincode}
          </p>
          <p className={styles.addressMobile}>{address.mobileNumber}</p>
          <Link to="/contact" className={styles.supportLink}>
            <HeadsetIcon />
            Contact Support
          </Link>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardHeading}>Payment Details</h2>
          <div className={styles.priceRows}>
            <div className={styles.priceRow}>
              <span>Item Cost</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className={styles.priceRow}>
              <span>Shipping</span>
              <span className={order.shippingAmount > 0 ? undefined : styles.freeValue}>
                {order.shippingAmount > 0 ? formatPrice(order.shippingAmount) : 'Free'}
              </span>
            </div>
            {order.discountAmount > 0 && (
              <div className={styles.priceRow}>
                <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                <span className={styles.discountValue}>- {formatPrice(order.discountAmount)}</span>
              </div>
            )}
            <div className={styles.priceRow}>
              <span>Tax (GST)</span>
              <span>{formatPrice(order.gstAmount)}</span>
            </div>
          </div>

          <div className={styles.totalRow}>
            <span>Total</span>
            <span className={styles.totalValue}>{formatPrice(order.totalAmount)}</span>
          </div>

          <p className={styles.securePayNote}>
            <ShieldCheckIcon />
            Payment completed securely
          </p>
        </section>

        <div className={styles.finalActions}>
          <Link to={orderDetailHref} className={styles.primaryButtonFull}>
            Track Order
          </Link>
          <Link to="/" className={styles.secondaryButtonFull}>
            Continue Shopping
          </Link>
        </div>
      </main>
    </div>
  );
}
