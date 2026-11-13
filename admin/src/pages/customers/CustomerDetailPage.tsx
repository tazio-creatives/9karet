import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminCustomer } from '../../api/customers';
import { formatPrice } from '../../utils/formatPrice';
import { formatOrderStatus } from '../../utils/orderStatus';
import sharedStyles from '../../styles/shared.module.css';
import styles from './CustomerDetailPage.module.css';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-customer', id],
    queryFn: () => fetchAdminCustomer(id as string),
    enabled: !!id,
  });

  if (isLoading) return <p>Loading…</p>;
  if (isError || !data) {
    return (
      <div>
        <Link to="/customers" className={styles.back}>
          ← Back to customers
        </Link>
        <p className={sharedStyles.empty}>Customer not found.</p>
      </div>
    );
  }

  const { customer, orders } = data;

  return (
    <div>
      <Link to="/customers" className={styles.back}>
        ← Back to customers
      </Link>

      <div className={sharedStyles.pageHeader}>
        <div>
          <h1 className={sharedStyles.pageTitle}>{customer.fullName ?? customer.mobileNumber}</h1>
          <p className={styles.subtext}>
            {customer.mobileNumber} {customer.email ? `· ${customer.email}` : ''}
          </p>
        </div>
      </div>

      <section className={sharedStyles.cardPadded}>
        <h2 className={styles.sectionHeading}>Orders</h2>
        {orders.length === 0 && <p className={sharedStyles.empty}>No orders yet.</p>}
        {orders.length > 0 && (
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Total</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/orders/${order.id}`}>{order.orderNumber}</Link>
                  </td>
                  <td>{formatOrderStatus(order.orderStatus)}</td>
                  <td>{formatPrice(order.totalAmount)}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
