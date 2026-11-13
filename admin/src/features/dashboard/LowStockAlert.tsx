import { Link } from 'react-router-dom';
import type { DashboardLowStockProduct } from '../../api/dashboard';
import styles from './LowStockAlert.module.css';

// Genuinely a state (a product IS low/out of stock right now), so this is
// the one place on the dashboard that reaches for the app's real status
// palette (warning/danger) rather than a categorical hue — never color
// alone, per the dataviz skill's status rule: paired with an icon + the
// exact count as text on every row.
export function LowStockAlert({ products }: { products: DashboardLowStockProduct[] }) {
  if (products.length === 0) {
    return <p className={styles.empty}>Nothing running low — all published products are well stocked.</p>;
  }

  return (
    <ul className={styles.list}>
      {products.map((product) => {
        const isOut = product.availableStock === 0;
        return (
          <li key={product.id} className={styles.row}>
            {product.primaryImageUrl ? (
              <img src={product.primaryImageUrl} alt="" className={styles.thumb} />
            ) : (
              <span className={styles.thumbPlaceholder} />
            )}
            <Link to={`/products/${product.id}/edit`} className={styles.name} title={product.name}>
              {product.name}
            </Link>
            <span className={isOut ? styles.badgeDanger : styles.badgeWarning}>
              {isOut ? 'Out of stock' : `${product.availableStock} left`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
