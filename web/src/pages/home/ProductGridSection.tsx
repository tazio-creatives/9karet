import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { QuickAddSheet } from '../../features/plp/QuickAddSheet';
import { useQuickAdd } from '../../features/plp/useQuickAdd';
import { TabProductCard } from './ProductTabsSection';
import styles from './ProductGridSection.module.css';

// Homepage "Product Grid": a centred heading, two rows of product cards (the
// same cards as Product Tabs) from the category or collection picked on the
// section's first item, and a "View All Products" button to that listing.
export function ProductGridSection({ items, heading }: { items: HomepageItem[]; heading?: string | null }) {
  const source = items[0];
  const quickAdd = useQuickAdd();
  const products = (source?.products ?? []).slice(0, 10);
  if (!source || products.length === 0) return null;

  const viewAllHref = source.collection
    ? `/collections/${source.collection.slug}`
    : source.category
      ? `/${source.category.slug}`
      : source.ctaUrl || '/products';

  return (
    <section className={styles.section} aria-label={heading || 'Products'}>
      {heading && <h2 className={styles.title}>{heading}</h2>}

      <div className={styles.grid}>
        {products.map((product, i) => (
          <TabProductCard
            key={product.id}
            product={product}
            index={i}
            hideNewTag
            onAdd={() => quickAdd.addToCart(product)}
            isAdding={quickAdd.pendingProductId === product.id}
            justAdded={quickAdd.justAddedProductId === product.id}
            hasError={quickAdd.errorProductId === product.id}
          />
        ))}
      </div>

      <div className={styles.ctaRow}>
        <Link to={viewAllHref} className={styles.cta}>
          {source.ctaLabel || 'View All Products'}
        </Link>
      </div>

      {quickAdd.sheetProduct && <QuickAddSheet product={quickAdd.sheetProduct} onClose={quickAdd.closeSheet} />}
    </section>
  );
}
