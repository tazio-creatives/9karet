import { useEffect, useRef } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import { fetchInvoice, recordInvoicePrint } from '../../api/orders';
import { ApiError } from '../../api/client';
import { useAdmin } from '../../features/auth/useAdmin';
import { formatPrice } from '../../utils/formatPrice';
import { COMPANY_INFO } from '../../constants/companyInfo';
import styles from './InvoicePrintPage.module.css';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// GST is snapshotted on order_items/orders only as a ₹ amount, never as a
// rate (products.gst_percent isn't copied at checkout) — so the % shown
// here is back-computed from the frozen pre-tax base, exactly like the
// storefront's cart/checkout summary does, rather than read from the
// product's *current* gst_percent (which could've changed since purchase).
function gstPercent(gstAmount: number, preTaxBase: number) {
  if (preTaxBase <= 0) return 0;
  return Math.round((gstAmount / preTaxBase) * 100);
}

// Internal-only, admin-authenticated print view — deliberately rendered
// outside AdminLayout (no sidebar/header chrome), mirroring
// WorkOrderPrintPage's structure: A5 tax invoice instead of A4 job card.
export function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoggedIn, isLoading: isAuthLoading } = useAdmin();
  const hasLoggedPrint = useRef(false);
  const barcodeRef = useRef<SVGSVGElement>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => fetchInvoice(id as string),
    enabled: !!id && isLoggedIn,
  });

  // Same "log exactly one print event per page load" pattern as the work
  // order print page — re-opening this page is the proxy for "someone
  // needed this invoice again," not the browser print dialog itself.
  const printMutation = useMutation({
    mutationFn: () => recordInvoicePrint(id as string),
  });

  useEffect(() => {
    if (!data || hasLoggedPrint.current) return;
    hasLoggedPrint.current = true;
    printMutation.mutate();
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data || !barcodeRef.current) return;
    JsBarcode(barcodeRef.current, data.order.orderNumber, {
      format: 'CODE128',
      width: 1.4,
      height: 34,
      fontSize: 11,
      margin: 0,
      displayValue: true,
    });
  }, [data]);

  useEffect(() => {
    if (!printMutation.isSuccess) return;
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [printMutation.isSuccess]);

  if (!isAuthLoading && !isLoggedIn) return <Navigate to="/login" replace />;
  if (isLoading || isAuthLoading) return <p className={styles.status}>Loading invoice…</p>;
  if (isError || !data) {
    return (
      <div className={styles.status}>
        <p>{error instanceof ApiError ? error.message : 'Could not load this invoice.'}</p>
        {id && (
          <Link to={`/orders/${id}`} className={styles.backLink}>
            ← Back to order
          </Link>
        )}
      </div>
    );
  }

  const { order, invoiceNumber, invoiceGeneratedAt } = data;
  const address = order.shippingAddress;
  const orderGstPercent = gstPercent(order.gstAmount, order.subtotal);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Link to={`/orders/${order.id}`} className={styles.backLink}>
          ← Back to order
        </Link>
        <button type="button" className={styles.printButton} onClick={() => window.print()}>
          Print
        </button>
      </div>

      <div className={styles.sheet}>
        <header className={styles.header}>
          <div className={styles.sellerBlock}>
            <img src="/images/logo.png" alt={COMPANY_INFO.displayName} className={styles.logo} />
            <p className={styles.sellerName}>{COMPANY_INFO.legalName}</p>
            {COMPANY_INFO.addressLines.map((line) => (
              <p key={line} className={styles.sellerLine}>
                {line}
              </p>
            ))}
            <p className={styles.sellerLine}>CIN: {COMPANY_INFO.cin}</p>
            <p className={styles.sellerLine}>GSTIN: {COMPANY_INFO.gstin}</p>
          </div>
          <div className={styles.docBlock}>
            <p className={styles.docTitle}>Tax Invoice</p>
            <p className={styles.invoiceNumber}>{invoiceNumber}</p>
            <p className={styles.docMeta}>
              <strong>Date</strong> {formatDate(invoiceGeneratedAt)}
            </p>
            <p className={styles.docMeta}>
              <strong>Order</strong> {order.orderNumber}
            </p>
            <p className={styles.docMeta}>
              <strong>Placed</strong> {formatDate(order.createdAt)}
            </p>
          </div>
        </header>

        <section className={styles.billTo}>
          <h2 className={styles.sectionLabel}>Bill To</h2>
          <p className={styles.billName}>{order.contactName}</p>
          <p>{address.addressLine}</p>
          {address.building && <p>{address.building}</p>}
          {address.landmark && <p>{address.landmark}</p>}
          <p>
            {address.city}, {address.state} – {address.pincode}
          </p>
          <p>Phone: {order.contactMobile}</p>
        </section>

        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th className={styles.colNo}>#</th>
              <th className={styles.colItem}>Item</th>
              <th className={styles.colQty}>Qty</th>
              <th className={styles.colAmt}>Gold</th>
              <th className={styles.colAmt}>Stones</th>
              <th className={styles.colAmt}>Making</th>
              <th className={styles.colAmt}>GST</th>
              <th className={styles.colAmt}>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => {
              const preTaxBase = item.goldValue + item.stoneValue + item.makingCharge;
              const pct = gstPercent(item.gstAmount, preTaxBase);
              return (
                <tr key={item.id} className={styles.itemRow}>
                  <td className={styles.colNo}>{i + 1}</td>
                  <td className={styles.colItem}>
                    <p className={styles.itemName}>{item.productName}</p>
                    <p className={styles.itemMeta}>
                      SKU {item.productSku}
                      {item.purity ? ` · ${item.purity}` : ''}
                      {item.sizeLabel ? ` · Size ${item.sizeLabel}` : ''}
                    </p>
                  </td>
                  <td className={styles.colQty}>{item.quantity}</td>
                  <td className={styles.colAmt}>{formatPrice(item.goldValue)}</td>
                  <td className={styles.colAmt}>{formatPrice(item.stoneValue)}</td>
                  <td className={styles.colAmt}>{formatPrice(item.makingCharge)}</td>
                  <td className={styles.colAmt}>
                    {formatPrice(item.gstAmount)}
                    <span className={styles.gstPct}>({pct}%)</span>
                  </td>
                  <td className={styles.colAmt}>{formatPrice(item.lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className={styles.totalsBlock}>
          <div className={styles.totalsRow}>
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className={styles.totalsRow}>
              <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
              <span>-{formatPrice(order.discountAmount)}</span>
            </div>
          )}
          <div className={styles.totalsRow}>
            <span>GST ({orderGstPercent}%)</span>
            <span>{formatPrice(order.gstAmount)}</span>
          </div>
          <div className={styles.totalsRow}>
            <span>Shipping</span>
            <span>{order.shippingAmount > 0 ? formatPrice(order.shippingAmount) : 'Free'}</span>
          </div>
          <div className={`${styles.totalsRow} ${styles.grandTotal}`}>
            <span>Grand Total</span>
            <span>{formatPrice(order.totalAmount)}</span>
          </div>
        </div>

        <footer className={styles.footer}>
          <p className={styles.disclaimer}>
            This is a computer-generated invoice. For queries, contact {COMPANY_INFO.email}.
          </p>
          <div className={styles.barcodeBlock}>
            <svg ref={barcodeRef} className={styles.barcode} />
          </div>
        </footer>
      </div>
    </div>
  );
}
