import { Link } from 'react-router-dom';
import type { ProductCard as ProductCardType } from '../../api/types';
import { ProductCard } from '../../components/ProductCard';
import styles from './RelatedProducts.module.css';

export function RelatedProducts({
  products,
  categorySlug,
  heading = 'You May Also Like',
  className,
}: {
  products: ProductCardType[];
  categorySlug: string | null;
  heading?: string;
  // Lets a caller (CartPage) override the section's own top spacing without
  // changing it for every other usage (PDP's "You May Also Like").
  className?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className={className ? `${styles.section} ${className}` : styles.section}>
      <div className={styles.header}>
        <h2 className={styles.heading}>{heading}</h2>
        {categorySlug && (
          <Link to={`/${categorySlug}`} className={styles.viewAllLink}>
            View All →
          </Link>
        )}
      </div>
      <div className={styles.grid}>
        {products.map((p, i) => (
          <div key={p.id} className={styles.gridItem}>
            <ProductCard product={p} index={i} imagePadding={false} />
          </div>
        ))}
      </div>
    </section>
  );
}
