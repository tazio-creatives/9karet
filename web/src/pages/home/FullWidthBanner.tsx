import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { productUrl } from '../../utils/productUrl';
import styles from './FullWidthBanner.module.css';

function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.collection) return `/collections/${item.collection.slug}`;
  if (item.category) return `/${item.category.slug}`;
  if (item.product) return productUrl({ slug: item.product.slug, categorySlug: null });
  return null;
}

// "Full Width Banner": one edge-to-edge image banner (separate desktop and
// mobile images), clickable to a collection / category / product / URL.
// Text is optional — leave Heading / Subheading / CTA Label empty when the
// artwork already carries its own wording.
export function FullWidthBanner({ items }: { items: HomepageItem[] }) {
  const item = items[0];
  if (!item) return null;

  const href = linkFor(item);
  const label = item.heading || item.collection?.name || item.category?.name || '9KARET';
  const hasText = Boolean(item.heading || item.subheading || item.ctaLabel);

  const content = (
    <>
      {item.imageUrl ? (
        <picture className={styles.image}>
          {item.imageUrlMobile && <source media="(max-width: 767px)" srcSet={item.imageUrlMobile} />}
          <img src={item.imageUrl} alt={`${label} — 9KARET`} loading="lazy" decoding="async" />
        </picture>
      ) : (
        <span className={`${styles.image} ${styles.placeholder}`} aria-hidden="true" />
      )}
      {hasText && (
        <span className={styles.text}>
          {item.subheading && <span className={styles.eyebrow}>{item.subheading}</span>}
          {item.heading && <span className={styles.title}>{item.heading}</span>}
          {item.ctaLabel && (
            <span className={styles.cta}>
              {item.ctaLabel} <span aria-hidden="true">↗</span>
            </span>
          )}
        </span>
      )}
    </>
  );

  return (
    <section className={styles.section}>
      {href ? (
        <Link to={href} className={styles.banner} aria-label={label}>
          {content}
        </Link>
      ) : (
        <div className={styles.banner}>{content}</div>
      )}
    </section>
  );
}
