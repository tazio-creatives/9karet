import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchProductVariants } from '../../api/products';
import styles from './ProductVariations.module.css';

interface AdvancedVariantSummaryProps {
  productId: string;
}

// Collapsed-by-default summary of an existing product's real combinations —
// deliberately doesn't render the full per-combination table inline (that's
// the dedicated /products/:id/variants page, already built and tested).
// This just answers "how many combinations, how many active/excluded/
// customized" at a glance, with one button into the full editor.
export function AdvancedVariantSummary({ productId }: AdvancedVariantSummaryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-product-variants', productId],
    queryFn: () => fetchProductVariants(productId),
  });

  const variants = data?.variants ?? [];
  const total = variants.length;
  const active = variants.filter((v) => v.isAvailable).length;
  const excluded = total - active;
  const customWeight = variants.filter((v) => v.goldWeightGrams != null).length;

  return (
    <div className={styles.advancedPanel}>
      <div className={styles.advancedHead}>
        <div className={styles.advancedTitleRow}>
          <span className={styles.advancedTitle}>Advanced Variant Management</span>
          {!isLoading && (
            <>
              <span className={styles.badge}>{total} combination{total === 1 ? '' : 's'}</span>
              {active > 0 && <span className={styles.badgeSuccess}>{active} active</span>}
              {excluded > 0 && <span className={styles.badgeWarning}>{excluded} excluded</span>}
              {customWeight > 0 && <span className={styles.badgeAccent}>{customWeight} custom weight</span>}
            </>
          )}
        </div>
        <Link to={`/products/${productId}/variants`} className={styles.manageBtn}>
          Manage Exceptions →
        </Link>
      </div>
      <p className={styles.advancedSub}>
        Edit an exact combination only when it differs from the defaults above.
      </p>
    </div>
  );
}
