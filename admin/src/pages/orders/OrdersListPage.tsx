import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminOrders, fetchAdminOrderSummary } from '../../api/orders';
import type { OrderListItem, StatusFilterValue } from '../../api/types';
import { formatPrice } from '../../utils/formatPrice';
import { shortOrderNumber } from '../../utils/orderNumber';
import { STATUS_FILTER_VALUES, ORDER_STATUS_BADGE_CLASS, formatOrderStatus } from '../../utils/orderStatus';
import { OrderDetailPanel } from './OrderDetailPanel';
import { useSidebar } from '../../layouts/SidebarContext';
import { OrdersStatIcon, CalendarStatIcon, WalletStatIcon, AverageStatIcon, TruckStatIcon } from '../DashboardIcons';
import sharedStyles from '../../styles/shared.module.css';
import styles from './OrdersListPage.module.css';

const STATUSES = STATUS_FILTER_VALUES;
const STATUS_CLASS = ORDER_STATUS_BADGE_CLASS;

// order_status is null until payment succeeds — falls back to a
// payment-driven pseudo-status so the list/CSV always has something to show.
function displayStatus(order: OrderListItem): StatusFilterValue {
  return order.orderStatus ?? (order.paymentStatus === 'FAILED' ? 'PAYMENT_FAILED' : 'PENDING_PAYMENT');
}

// Client-side only — exports whatever page of orders is currently loaded
// (matching the active status filter), no new backend endpoint needed.
function exportOrdersCsv(orders: OrderListItem[]) {
  const header = ['Order', 'Status', 'Customer', 'Mobile', 'Product', 'Items', 'Total', 'Placed'];
  const rows = orders.map((o) => [
    o.orderNumber,
    formatOrderStatus(displayStatus(o)),
    o.contactName,
    o.contactMobile,
    o.productName ?? '',
    String(o.itemCount),
    o.totalAmount.toFixed(2),
    new Date(o.createdAt).toISOString(),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function OrdersListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get('status') as StatusFilterValue | null) ?? undefined;
  const selectedOrderId = searchParams.get('order');
  const urlSearch = searchParams.get('q') ?? '';
  const [page, setPage] = useState(1);
  const { collapseSidebar } = useSidebar();

  // Local input state, debounced into the URL — matches order number (what
  // the work order's barcode encodes; a barcode scanner just keystrokes the
  // decoded value in here, same as typing it) or contact mobile. Debounced
  // rather than searching on every keystroke, since a scanner "types" the
  // whole code near-instantly anyway.
  const [searchInput, setSearchInput] = useState(urlSearch);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput === urlSearch) return;
      const next = new URLSearchParams(searchParams);
      if (searchInput.trim()) next.set('q', searchInput.trim());
      else next.delete('q');
      setSearchParams(next);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', { status, page, search: urlSearch }],
    queryFn: () => fetchAdminOrders(status, page, 20, urlSearch || undefined),
  });

  // Sales card in the page heading — a single aggregate query over every
  // matching order, not a sum of the current page, so it stays correct
  // regardless of pagination. Scoped to the active status filter, same as
  // the table below it.
  const { data: summary } = useQuery({
    queryKey: ['admin-orders-summary', { status }],
    queryFn: () => fetchAdminOrderSummary(status),
  });

  function selectOrder(id: string) {
    collapseSidebar();
    const next = new URLSearchParams(searchParams);
    next.set('order', id);
    setSearchParams(next);
  }

  function closePanel() {
    const next = new URLSearchParams(searchParams);
    next.delete('order');
    setSearchParams(next);
  }

  function setStatus(value: StatusFilterValue | '') {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('status', value);
    else next.delete('status');
    setSearchParams(next);
    setPage(1);
  }

  return (
    <div className={`${styles.pageContainer} full-width-page`}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Orders</h1>
          <p className={styles.pageDescription}>Manage customer orders, payments and fulfilment.</p>
        </div>
        <button
          type="button"
          className={styles.exportButton}
          disabled={!data || data.orders.length === 0}
          onClick={() => data && exportOrdersCsv(data.orders)}
        >
          Export
        </button>
      </div>

      <div className={styles.salesGrid}>
        <div className={styles.salesCard}>
          <span className={`${styles.salesIcon} ${styles.salesIconIndigo}`}>
            <OrdersStatIcon />
          </span>
          <div>
            <p className={styles.salesLabel}>Total Orders</p>
            <p className={styles.salesValue}>{summary ? summary.totalOrders : '—'}</p>
          </div>
        </div>
        <div className={styles.salesCard}>
          <span className={`${styles.salesIcon} ${styles.salesIconTeal}`}>
            <CalendarStatIcon />
          </span>
          <div>
            <p className={styles.salesLabel}>Today's Orders</p>
            <p className={styles.salesValue}>{summary ? summary.ordersToday : '—'}</p>
          </div>
        </div>
        <div className={styles.salesCard}>
          <span className={`${styles.salesIcon} ${styles.salesIconGold}`}>
            <WalletStatIcon />
          </span>
          <div>
            <p className={styles.salesLabel}>Total Revenue</p>
            <p className={styles.salesValue}>{summary ? formatPrice(summary.totalRevenue) : '—'}</p>
          </div>
        </div>
        <div className={styles.salesCard}>
          <span className={`${styles.salesIcon} ${styles.salesIconViolet}`}>
            <AverageStatIcon />
          </span>
          <div>
            <p className={styles.salesLabel}>Avg. Order Value</p>
            <p className={styles.salesValue}>{summary ? formatPrice(summary.averageOrderValue) : '—'}</p>
          </div>
        </div>
        <div className={styles.salesCard}>
          <span className={`${styles.salesIcon} ${styles.salesIconGreen}`}>
            <TruckStatIcon />
          </span>
          <div>
            <p className={styles.salesLabel}>To Fulfil</p>
            <p className={styles.salesValue}>{summary ? summary.toFulfilCount : '—'}</p>
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={!status ? styles.tabActive : styles.tab}
          onClick={() => setStatus('')}
        >
          All Orders
        </button>
        <button
          type="button"
          className={status === 'PENDING_PAYMENT' ? styles.tabActive : styles.tab}
          onClick={() => setStatus('PENDING_PAYMENT')}
        >
          Pending
        </button>
        <button
          type="button"
          className={status === 'CONFIRMED' ? styles.tabActive : styles.tab}
          onClick={() => setStatus('CONFIRMED')}
        >
          Confirmed
        </button>
        <button
          type="button"
          className={status === 'RETURN_INITIATED' ? styles.tabActive : styles.tab}
          onClick={() => setStatus('RETURN_INITIATED')}
        >
          Returns
        </button>
        <button
          type="button"
          className={status === 'REFUND_PENDING' ? styles.tabActive : styles.tab}
          onClick={() => setStatus('REFUND_PENDING')}
        >
          Refunds Pending
        </button>
      </div>

      <div className={styles.filters}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search order ID, phone, or scan barcode…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={status ?? ''}
          onChange={(e) => setStatus(e.target.value as StatusFilterValue | '')}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatOrderStatus(s)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.splitLayout}>
        <div className={styles.listColumn}>
          <div className={sharedStyles.card}>
            {isLoading && <p className={sharedStyles.empty}>Loading…</p>}
            {!isLoading && data && data.orders.length === 0 && (
              <p className={sharedStyles.empty}>No orders match this filter.</p>
            )}
            {!isLoading && data && data.orders.length > 0 && (
              <div className={styles.tableScroll}>
                <table className={`${sharedStyles.table} ${styles.ordersTable}`}>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Product</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Placed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((order) => (
                      <tr
                        key={order.id}
                        className={order.id === selectedOrderId ? styles.rowSelected : styles.row}
                        onClick={() => selectOrder(order.id)}
                      >
                        <td>
                          <span className={styles.orderLink} title={order.orderNumber}>
                            {shortOrderNumber(order.orderNumber)}
                          </span>
                        </td>
                        <td>
                          {order.productName ?? '—'}
                          {order.itemCount > 1 && (
                            <div className={styles.subtext}>+{order.itemCount - 1} more</div>
                          )}
                        </td>
                        <td>
                          {order.contactName}
                          <div className={styles.mobile}>{order.contactMobile}</div>
                        </td>
                        <td>
                          <span className={sharedStyles[STATUS_CLASS[displayStatus(order)] ?? 'badgeNeutral']}>
                            {formatOrderStatus(displayStatus(order))}
                          </span>
                        </td>
                        <td>{formatPrice(order.totalAmount)}</td>
                        <td>{new Date(order.createdAt).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {data && data.totalPages > 1 && (
            <div className={sharedStyles.pagination}>
              <button
                type="button"
                className={sharedStyles.button}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                Page {data.page} of {data.totalPages}
              </span>
              <button
                type="button"
                className={sharedStyles.button}
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {selectedOrderId && (
          <>
            <div className={styles.backdrop} onClick={closePanel} />
            <OrderDetailPanel orderId={selectedOrderId} onClose={closePanel} />
          </>
        )}
      </div>
    </div>
  );
}
