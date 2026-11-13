import { useEffect, useRef, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import { fetchWorkOrder, recordWorkOrderPrint } from '../../api/orders';
import { ApiError } from '../../api/client';
import { useAdmin } from '../../features/auth/useAdmin';
import styles from './WorkOrderPrintPage.module.css';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function Spec({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className={styles.specItem}>
      <span className={styles.specLabel}>{label}</span>
      <span className={styles.specValue}>{value}</span>
    </div>
  );
}

// Internal-only, admin-authenticated print view — deliberately rendered
// outside AdminLayout (no sidebar/header chrome) so the printed sheet
// contains only the work order itself. Never linked from anywhere a
// customer could reach.
export function WorkOrderPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoggedIn, isLoading: isAuthLoading } = useAdmin();
  const [printedAt] = useState(() => new Date().toISOString());
  const hasLoggedPrint = useRef(false);
  const barcodeRef = useRef<SVGSVGElement>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['work-order', id],
    queryFn: () => fetchWorkOrder(id as string),
    enabled: !!id && isLoggedIn,
  });

  // Logs exactly one print event per page load/visit (first load = Printed,
  // any later visit to the same URL = Reprinted) — not tied to the browser
  // print dialog itself, since there's no reliable "print completed" event
  // to hook, and re-opening this page is a reasonable proxy for "someone
  // needed this work order again."
  const printMutation = useMutation({
    mutationFn: () => recordWorkOrderPrint(id as string),
  });

  useEffect(() => {
    if (!data || hasLoggedPrint.current) return;
    hasLoggedPrint.current = true;
    printMutation.mutate();
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Barcode over QR — warehouse staff use handheld linear-barcode scanners,
  // and the same order number now also drives the admin Orders list search
  // (see OrdersListPage), so scanning this jumps straight to the order.
  useEffect(() => {
    if (!data || !barcodeRef.current) return;
    JsBarcode(barcodeRef.current, data.order.orderNumber, {
      format: 'CODE128',
      width: 1.6,
      height: 42,
      fontSize: 13,
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
  if (isLoading || isAuthLoading) return <p className={styles.status}>Loading work order…</p>;
  if (isError || !data) {
    return (
      <div className={styles.status}>
        <p>{error instanceof ApiError ? error.message : 'Could not load this work order.'}</p>
        {id && (
          <Link to={`/orders/${id}`} className={styles.backLink}>
            ← Back to order
          </Link>
        )}
      </div>
    );
  }

  const { order, processingStartedAt } = data;
  const printResult = printMutation.data;

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
        {printResult?.isReprint && <div className={styles.reprintStamp}>REPRINT #{printResult.printNumber}</div>}

        <header className={styles.header}>
          <div>
            <img src="/images/logo.png" alt="9Karet" className={styles.logo} />
            <p className={styles.docTitle}>Work Order</p>
          </div>
          <div className={styles.headerMeta}>
            <p>
              <strong>Order</strong> {order.orderNumber}
            </p>
            <p>
              <strong>Placed</strong> {formatDate(order.createdAt)}
            </p>
            <p>
              <strong>Processing started</strong> {formatDate(processingStartedAt)}
            </p>
            <p>
              <strong>Printed</strong> {formatDate(printedAt)}
            </p>
          </div>
        </header>

        <section className={styles.customerBlock}>
          <h2 className={styles.sectionLabel}>Customer</h2>
          <p>{order.contactName}</p>
        </section>

        <div className={styles.items}>
          {order.items.map((item, i) => {
            return (
              <div key={item.id} className={styles.itemCard}>
                <div className={styles.itemImageBlock}>
                  {item.productImageUrl ? (
                    <img src={item.productImageUrl} alt="" className={styles.productImg} />
                  ) : (
                    <span className={styles.productImgPlaceholder} />
                  )}
                </div>
                <div className={styles.itemInfo}>
                  <div className={styles.itemHeaderRow}>
                    <p className={styles.itemName}>
                      {i + 1}. {item.productName}
                    </p>
                    <span className={styles.itemQty}>Qty {item.quantity}</span>
                  </div>
                  <p className={styles.itemSku}>
                    SKU {item.productSku}
                    {item.categoryName ? ` · ${item.categoryName}` : ''}
                  </p>

                  <div className={styles.specGrid}>
                    <Spec label="Gold Colour" value={item.goldColor} />
                    <Spec label="Gold Purity" value={item.purity} />
                    <Spec label="Gold Wt (g)" value={item.goldWeightGrams != null ? item.goldWeightGrams.toFixed(3) : null} />
                    <Spec label="Size" value={item.sizeLabel} />
                    {item.stones.map((stone, si) => (
                      <Spec
                        key={si}
                        label={`Stone: ${stone.stoneTypeName}`}
                        value={`${stone.count} pc${stone.weightCarats != null ? ` · ${stone.weightCarats.toFixed(3)} ct` : ''}`}
                      />
                    ))}
                  </div>

                  {item.customizationNote && (
                    <p className={styles.customization}>Customization: {item.customizationNote}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <footer className={styles.footer}>
          <div className={styles.signatures}>
            <div className={styles.signatureLine}>
              <span /> Prepared By
            </div>
            <div className={styles.signatureLine}>
              <span /> Checked By
            </div>
            <div className={styles.signatureLine}>
              <span /> Packed By
            </div>
          </div>
          <div className={styles.barcodeBlock}>
            <svg ref={barcodeRef} className={styles.barcode} />
          </div>
        </footer>
        <p className={styles.disclaimer}>Internal work order — not a customer invoice.</p>
      </div>
    </div>
  );
}
