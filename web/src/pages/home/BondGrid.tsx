import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { productUrl } from '../../utils/productUrl';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './BondGrid.module.css';

// Same link precedence as BentoCard: explicit CTA URL, then the linked
// category / collection / product.
function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.collection) return `/collections/${item.collection.slug}`;
  if (item.category) return `/${item.category.slug}`;
  if (item.product) return productUrl({ slug: item.product.slug, categorySlug: null });
  return null;
}

// "Shop by Bond" — portrait photo tiles with a label band underneath
// (Mother, Wife, Brother…). 3 per row on mobile, 6 in one row on desktop.
export function BondGrid({ items }: { items: HomepageItem[] }) {
  return (
    <div className={styles.grid}>
      {items.map((item, index) => {
        const href = linkFor(item);
        const imageUrl = item.imageUrl ?? item.category?.imageUrl ?? null;
        const label = item.heading ?? item.collection?.name ?? item.category?.name ?? '';
        const body = (
          <>
            <span className={styles.photo} style={imageUrl ? undefined : { background: placeholderGradient(index) }}>
              {imageUrl && (
                <img src={imageUrl} alt={label ? `Diamond jewellery gifts for ${label}` : 'Diamond jewellery gift'} loading="lazy" />
              )}
            </span>
            <span className={styles.label}>{label}</span>
          </>
        );
        return href ? (
          <Link key={item.id} to={href} className={styles.tile}>
            {body}
          </Link>
        ) : (
          <div key={item.id} className={styles.tile}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
