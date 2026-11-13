import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchOrderById } from '../../api/orders';
import { OrderDetails } from '../../features/orders/OrderDetails';
import { OrderSidebar } from '../../features/orders/OrderSidebar';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import { useTawkChat } from '../../features/support/useTawkChat';
import styles from './OrderDetailPage.module.css';

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrderById(orderId as string),
    enabled: !!orderId,
  });

  useDocumentTitle(data ? `Order ${data.order.orderNumber}` : 'Order');
  useTawkChat({ orderNumber: data?.order.orderNumber, orderStatus: data?.order.orderStatus });

  if (isLoading) {
    return (
      <div className={styles.grid} aria-busy="true">
        <div className={styles.main}>
          <div className={styles.skeletonCard} style={{ height: 140 }} />
          <div className={styles.skeletonCard} style={{ height: 220 }} />
          <div className={styles.skeletonCard} style={{ height: 140 }} />
        </div>
        <div className={styles.sidebar}>
          <div className={styles.skeletonCard} style={{ height: 180 }} />
          <div className={styles.skeletonCard} style={{ height: 180 }} />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.stateCard}>
        <p className={styles.stateTitle}>Order not found</p>
        <p className={styles.stateBody}>
          We couldn&apos;t load this order. It may not exist, or something went wrong on our end.
        </p>
        <div className={styles.stateActions}>
          <button type="button" className={styles.retryButton} onClick={() => refetch()}>
            Retry
          </button>
          <Link to="/account/orders" className={styles.back}>
            ← Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const { order } = data;

  return (
    <div className={styles.grid}>
      <div className={styles.main}>
        <OrderDetails order={order} />
      </div>
      <div className={styles.sidebar}>
        <OrderSidebar order={order} />
      </div>
    </div>
  );
}
