import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardStats } from '../api/dashboard';
import { fetchAdminOrders } from '../api/orders';
import { RevenueTrendChart } from '../features/dashboard/RevenueTrendChart';
import { OrderStatusBreakdown } from '../features/dashboard/OrderStatusBreakdown';
import { TopProductsList } from '../features/dashboard/TopProductsList';
import { LowStockAlert } from '../features/dashboard/LowStockAlert';
import { formatPrice } from '../utils/formatPrice';
import { shortOrderNumber } from '../utils/orderNumber';
import { formatOrderStatus } from '../utils/orderStatus';
import {
  OrdersStatIcon,
  ClockStatIcon,
  TruckStatIcon,
  ReturnStatIcon,
  ProductsStatIcon,
  CustomersStatIcon,
  WalletStatIcon,
  AlertStatIcon,
  TrendUpIcon,
  TrendDownIcon,
} from './DashboardIcons';
import sharedStyles from '../styles/shared.module.css';
import styles from './DashboardPage.module.css';

// Small inline "+12% vs last month" / "-4% vs last month" pill — null means
// there was nothing to compare against (see adminDashboard.controller.js's
// percentChange), rendered as nothing rather than a misleading "+100%" or
// "0%".
function ChangeBadge({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const isUp = percent >= 0;
  return (
    <span className={isUp ? styles.changeUp : styles.changeDown}>
      {isUp ? <TrendUpIcon /> : <TrendDownIcon />}
      {Math.abs(percent)}%
    </span>
  );
}

export function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: fetchDashboardStats,
  });
  const { data: recentOrders } = useQuery({
    queryKey: ['admin-orders', 'recent'],
    queryFn: () => fetchAdminOrders(undefined, 1, 5),
  });

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <div>
          <h1 className={sharedStyles.pageTitle}>Dashboard</h1>
          <p className={styles.subtitle}>Overview of your store's performance</p>
        </div>
      </div>

      <div className={styles.heroGrid}>
        <div className={styles.heroCard}>
          <p className={styles.heroLabel}>Total Revenue</p>
          <p className={styles.heroValue}>{stats ? formatPrice(stats.totalRevenue) : '—'}</p>
          <p className={styles.heroFoot}>
            <span className={styles.heroFootValue}>{stats ? formatPrice(stats.revenueThisMonth) : '—'}</span>
            this month
            {stats && <ChangeBadge percent={stats.revenueChangePercent} />}
          </p>
          <div className={styles.heroDivider} />
          <div className={styles.heroSubStats}>
            <div>
              <p className={styles.heroSubLabel}>Avg. Order Value</p>
              <p className={styles.heroSubValue}>{stats ? formatPrice(stats.averageOrderValue) : '—'}</p>
            </div>
            <div>
              <p className={styles.heroSubLabel}>Orders this month</p>
              <p className={styles.heroSubValue}>
                {stats?.ordersThisMonth ?? '—'}
                {stats && <ChangeBadge percent={stats.ordersChangePercent} />}
              </p>
            </div>
          </div>
        </div>
        <div className={styles.trendCard}>
          <p className={styles.trendHeading}>Revenue — last 30 days</p>
          <div className={styles.trendChart}>
            {stats && <RevenueTrendChart data={stats.revenueTrend} />}
          </div>
        </div>
      </div>

      {!!stats?.refundPendingCount && (
        <Link to="/orders?status=REFUND_PENDING" className={styles.refundBanner}>
          <AlertStatIcon />
          <span>
            <strong>
              {stats.refundPendingCount} refund{stats.refundPendingCount === 1 ? '' : 's'} pending
            </strong>{' '}
            — cancelled or returned orders still marked paid. Customers were promised their refund within 7 days.
          </span>
          <span className={styles.refundBannerCta}>Review →</span>
        </Link>
      )}

      <div className={styles.statsGrid}>
        <Link to="/orders" className={styles.statCard}>
          <span className={styles.statIcon}>
            <OrdersStatIcon />
          </span>
          <div>
            <p className={styles.statLabel}>Total Orders</p>
            <p className={styles.statValue}>{stats?.totalOrders ?? '—'}</p>
          </div>
        </Link>
        <Link to="/orders?status=PENDING_PAYMENT" className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.statIconWarning}`}>
            <ClockStatIcon />
          </span>
          <div>
            <p className={styles.statLabel}>Pending Payment</p>
            <p className={styles.statValue}>{stats?.pendingPaymentCount ?? '—'}</p>
          </div>
        </Link>
        <Link to="/orders?status=PROCESSING" className={styles.statCard}>
          <span className={styles.statIcon}>
            <TruckStatIcon />
          </span>
          <div>
            <p className={styles.statLabel}>To Fulfill</p>
            <p className={styles.statValue}>{stats?.toFulfillCount ?? '—'}</p>
          </div>
        </Link>
        <Link to="/orders?status=RETURN_INITIATED" className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.statIconDanger}`}>
            <ReturnStatIcon />
          </span>
          <div>
            <p className={styles.statLabel}>Return Requests</p>
            <p className={styles.statValue}>{stats?.returnRequestedCount ?? '—'}</p>
          </div>
        </Link>
        <Link to="/products" className={styles.statCard}>
          <span className={styles.statIcon}>
            <ProductsStatIcon />
          </span>
          <div>
            <p className={styles.statLabel}>Products</p>
            <p className={styles.statValue}>{stats?.totalProducts ?? '—'}</p>
            <p className={styles.statSub}>{stats?.activeProducts ?? '—'} published</p>
          </div>
        </Link>
        <Link to="/customers" className={styles.statCard}>
          <span className={styles.statIcon}>
            <CustomersStatIcon />
          </span>
          <div>
            <p className={styles.statLabel}>Customers</p>
            <p className={styles.statValue}>{stats?.totalCustomers ?? '—'}</p>
            <p className={styles.statSub}>+{stats?.newCustomersThisMonth ?? '—'} this month</p>
          </div>
        </Link>
      </div>

      <div className={styles.insightsGrid}>
        <div className={sharedStyles.cardPadded}>
          <h2 className={styles.sectionHeading}>Order Status Breakdown</h2>
          {stats ? <OrderStatusBreakdown data={stats.orderStatusBreakdown} /> : <p className={sharedStyles.empty}>Loading…</p>}
        </div>

        <div className={sharedStyles.cardPadded}>
          <h2 className={styles.sectionHeading}>
            <WalletStatIcon />
            Top Products
          </h2>
          {stats ? <TopProductsList products={stats.topProducts} /> : <p className={sharedStyles.empty}>Loading…</p>}
        </div>
      </div>

      <div className={`${sharedStyles.cardPadded} ${styles.stackedCard}`}>
        <h2 className={styles.sectionHeading}>
          <AlertStatIcon />
          Low Stock
        </h2>
        {stats ? <LowStockAlert products={stats.lowStockProducts} /> : <p className={sharedStyles.empty}>Loading…</p>}
      </div>

      <div className={`${sharedStyles.cardPadded} ${styles.stackedCard}`}>
        <h2 className={styles.sectionHeading}>Recent Orders</h2>
        {recentOrders && recentOrders.orders.length === 0 && (
          <p className={sharedStyles.empty}>No orders yet.</p>
        )}
        {recentOrders && recentOrders.orders.length > 0 && (
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Product</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/orders/${order.id}`} title={order.orderNumber}>
                      {shortOrderNumber(order.orderNumber)}
                    </Link>
                  </td>
                  <td>
                    {order.productName ?? '—'}
                    {order.itemCount > 1 ? ` +${order.itemCount - 1} more` : ''}
                  </td>
                  <td>{order.contactName}</td>
                  <td>{formatOrderStatus(order.orderStatus)}</td>
                  <td>{formatPrice(order.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
