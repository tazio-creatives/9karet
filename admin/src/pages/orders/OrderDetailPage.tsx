import { Link, useParams } from 'react-router-dom';
import { OrderDetailContent } from './OrderDetailContent';
import styles from './OrderDetailPage.module.css';

// Standalone full-page route (/orders/:id) — still used for direct/shared
// links (e.g. the dashboard's Recent Orders table). The Orders list itself
// now opens the same OrderDetailContent in a slide-in side panel instead of
// navigating here (see OrderDetailPanel).
export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <Link to="/orders" className={styles.back}>
        ← Back to orders
      </Link>
      {id && <OrderDetailContent id={id} />}
    </div>
  );
}
