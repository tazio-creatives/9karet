import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { productUrl } from '../../utils/productUrl';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './BannerTrio.module.css';

// Kept in sync with the media query in BannerTrio.module.css.
const MOBILE_BREAKPOINT = '(max-width: 767px)';

function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.collection) return `/collections/${item.collection.slug}`;
  if (item.category) return `/${item.category.slug}`;
  if (item.product) return productUrl({ slug: item.product.slug, categorySlug: null });
  return null;
}

function Banner({ item, index, large }: { item: HomepageItem; index: number; large?: boolean }) {
  const href = linkFor(item);
  const alt = item.heading ?? item.collection?.name ?? item.category?.name ?? item.product?.name ?? '';
  const image = item.imageUrl ? (
    <picture>
      {item.imageUrlMobile && <source media={MOBILE_BREAKPOINT} srcSet={item.imageUrlMobile} />}
      <img src={item.imageUrl} alt={alt} loading="lazy" decoding="async" />
    </picture>
  ) : (
    <span className={styles.placeholder} style={{ background: placeholderGradient(index) }} aria-hidden="true" />
  );
  const className = `${styles.banner} ${large ? styles.large : styles.wide}`;
  return href ? (
    <Link to={href} className={className} aria-label={alt || undefined}>
      {image}
    </Link>
  ) : (
    <div className={className}>{image}</div>
  );
}

// "Banner Trio": item 1 is a large square banner on the left, items 2–3 are
// wide banners stacked on the right — image-only (the artwork carries its
// own text). On mobile they stack in order. Extra items are ignored.
export function BannerTrio({ items, heading }: { items: HomepageItem[]; heading?: string | null }) {
  const [main, top, bottom] = items;
  if (!main) return null;
  return (
    <section className={styles.section}>
      {heading && <h2 className={styles.heading}>{heading}</h2>}
      <div className={styles.grid}>
        <Banner item={main} index={0} large />
        {(top || bottom) && (
          <div className={styles.stack}>
            {top && <Banner item={top} index={1} />}
            {bottom && <Banner item={bottom} index={2} />}
          </div>
        )}
      </div>
    </section>
  );
}
