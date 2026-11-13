import { Link } from 'react-router-dom';
import type { DashboardTopProduct } from '../../api/dashboard';
import { formatPrice } from '../../utils/formatPrice';
import styles from './TopProductsList.module.css';

// Single series (revenue), so one hue throughout — bar length is the only
// encoding needed, no categorical palette required (dataviz skill: "a
// single series needs no legend box").
export function TopProductsList({ products }: { products: DashboardTopProduct[] }) {
  if (products.length === 0) {
    return <p className={styles.empty}>No sales yet.</p>;
  }

  const max = Math.max(...products.map((p) => p.revenue), 1);

  return (
    <ol className={styles.list}>
      {products.map((product, i) => (
        <li key={product.productId} className={styles.row}>
          <span className={styles.rank}>{i + 1}</span>
          {product.primaryImageUrl ? (
            <img src={product.primaryImageUrl} alt="" className={styles.thumb} />
          ) : (
            <span className={styles.thumbPlaceholder} />
          )}
          <div className={styles.info}>
            <Link to={`/products/${product.productId}/edit`} className={styles.name} title={product.name}>
              {product.name}
            </Link>
            <div className={styles.barTrack}>
              <div className={styles.bar} style={{ width: `${Math.max((product.revenue / max) * 100, 4)}%` }} />
            </div>
          </div>
          <div className={styles.figures}>
            <span className={styles.revenue}>{formatPrice(product.revenue)}</span>
            <span className={styles.units}>{product.unitsSold} sold</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
