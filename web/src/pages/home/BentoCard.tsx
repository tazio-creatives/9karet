import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { productUrl } from '../../utils/productUrl';
import { formatPrice } from '../../utils/formatPrice';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './BentoCard.module.css';

function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.category) return `/${item.category.slug}`;
  if (item.collection) return `/collections/${item.collection.slug}`;
  if (item.product) return productUrl({ slug: item.product.slug, categorySlug: null });
  return null;
}

interface BentoCardProps {
  item: HomepageItem;
  index: number;
  size?: 'sm' | 'md' | 'lg';
}

export function BentoCard({ item, index, size = 'md' }: BentoCardProps) {
  const href = linkFor(item);
  const gradient = placeholderGradient(index);
  // Bento tiles are usually linked to a category or product but managed as
  // their own homepage_items rows with their own optional image — falling
  // back to the linked category/product's own image means an admin only
  // has to upload it once (on the category, or a product photo) instead of
  // in both places.
  const imageUrl = item.imageUrl ?? item.category?.imageUrl ?? item.product?.imageUrl ?? null;

  const content = (
    <>
      <div className={styles.image} style={imageUrl ? undefined : { background: gradient }}>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={item.heading ?? item.category?.name ?? item.product?.name ?? ''}
            className={styles.imageTag}
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
      <div className={styles.caption}>
        {item.heading && <p className={styles.heading}>{item.heading}</p>}
        {item.product && <p className={styles.price}>{formatPrice(item.product.sellingPrice)}</p>}
        {item.ctaLabel && <span className={styles.cta}>{item.ctaLabel}</span>}
      </div>
    </>
  );

  const className = `${styles.card} ${styles[size]}`;

  return href ? (
    <Link to={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
