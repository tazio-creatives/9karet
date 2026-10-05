import { Link } from 'react-router-dom';
import { fetchProducts } from '../../api/products';
import { ProductCard } from '../../components/ProductCard';
import { useFixedProducts } from './useFixedProducts';
import styles from './CategoryProductGrid.module.css';

// "View All {category}" reads oddly for a singular category name (e.g.
// "View All Bangle") — a simple trailing-s pluralization covers every
// category name in use today (Bangle -> Bangles, Ring -> Rings, Pendant ->
// Pendants) and is a safe no-op for names already plural (Earrings, Gents).
function pluralize(name: string): string {
  return name.endsWith('s') ? name : `${name}s`;
}

interface CategoryProductGridProps {
  panelId: string;
  categorySlug: string;
  categoryName: string;
}

// Products for the currently-selected homepage category tile — fetched
// through the exact same `/products` endpoint, DTO and pricing the PLP/
// search/PDP already use (see api/products.ts's fetchProducts), so prices,
// discounts and eligibility filtering are guaranteed identical to visiting
// the category page directly. Rendered with the shared ProductCard
// component unmodified (same one NewArrivalsSection already reuses here).
// Product loading is a fixed batch of 15 (useFixedProducts, shared with
// CollectionProductShowcase.tsx) — mobile shows only the first 8 of it via
// CSS (.item:nth-child(n+9), 2 columns x 4 rows), desktop shows all 15 (5
// columns x 3 rows). A View All button always follows the grid instead of
// paginating further.
//
// Remounted (via the `key` the caller passes) on every category switch —
// that alone resets the hook's state and clears the previous category's
// cards from view.
export function CategoryProductGrid({ panelId, categorySlug, categoryName }: CategoryProductGridProps) {
  const { products, isLoading, error, retry } = useFixedProducts({
    fetchPage: async (limit) => {
      const result = await fetchProducts({ category: categorySlug, page: 1, limit });
      return { products: result.products, total: result.total };
    },
  });

  const categoryUrl = `/${categorySlug}`;

  return (
    <div id={panelId} className={styles.panel} role="region" aria-live="polite" aria-label={`${categoryName} products`}>
      {isLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={styles.skeletonImage} />
              <div className={styles.skeletonLine} style={{ width: '60%' }} />
              <div className={styles.skeletonLine} style={{ width: '85%' }} />
              <div className={styles.skeletonLine} style={{ width: '40%' }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className={styles.stateBlock}>
          <p className={styles.message}>Couldn&apos;t load products for this category.</p>
          <button type="button" className={styles.retryButton} onClick={() => retry()}>
            Try again
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className={styles.stateBlock}>
          <p className={styles.message}>No products available in this category.</p>
          <Link to={categoryUrl} className={styles.emptyLink}>
            View Category →
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {products.map((product, i) => (
              <div key={product.id} className={styles.item}>
                <ProductCard product={product} index={i} flat showNewBadge={false} />
              </div>
            ))}
          </div>

          <div className={styles.viewAllRow}>
            <Link to={categoryUrl} className={styles.viewAllButton}>
              View All {pluralize(categoryName)}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
