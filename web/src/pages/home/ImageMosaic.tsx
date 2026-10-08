import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { productUrl } from '../../utils/productUrl';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './ImageMosaic.module.css';

function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.collection) return `/collections/${item.collection.slug}`;
  if (item.category) return `/${item.category.slug}`;
  if (item.product) return productUrl({ slug: item.product.slug, categorySlug: null });
  return null;
}

function Tile({ item, index, tall }: { item: HomepageItem; index: number; tall?: boolean }) {
  const href = linkFor(item);
  const caption = item.heading;
  const alt = caption ?? item.collection?.name ?? item.category?.name ?? item.product?.name ?? '';
  const body = (
    <>
      <span className={styles.frame}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={alt} loading="lazy" decoding="async" />
        ) : (
          <span className={styles.placeholder} style={{ background: placeholderGradient(index) }} aria-hidden="true" />
        )}
      </span>
      {caption && <span className={styles.caption}>{caption}</span>}
    </>
  );
  const className = `${styles.tile} ${tall ? styles.tall : styles.short}`;
  return href ? (
    <Link to={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// "Jewellery Mosaic": item 1 tall (left), items 2–3 stacked with captions
// (middle), item 4 tall (right). On mobile, a 2 × 2 grid. Extra items are
// ignored.
export function ImageMosaic({
  items,
  heading,
  subheading,
}: {
  items: HomepageItem[];
  heading?: string | null;
  subheading?: string | null;
}) {
  const [left, top, bottom, right] = items;
  if (!left) return null;
  return (
    <section className={styles.section}>
      {heading && <h2 className={styles.heading}>{heading}</h2>}
      {subheading && <p className={styles.subheading}>{subheading}</p>}
      <div className={styles.grid}>
        <Tile item={left} index={0} tall />
        <div className={styles.middle}>
          {top && <Tile item={top} index={1} />}
          {bottom && <Tile item={bottom} index={2} />}
        </div>
        {right && <Tile item={right} index={3} tall />}
      </div>
    </section>
  );
}
