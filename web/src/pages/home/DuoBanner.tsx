import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { productUrl } from '../../utils/productUrl';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './DuoBanner.module.css';

function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.category) return `/${item.category.slug}`;
  if (item.collection) return `/collections/${item.collection.slug}`;
  if (item.product) return productUrl({ slug: item.product.slug, categorySlug: null });
  return null;
}

function imageFor(item: HomepageItem): string | null {
  return item.imageUrl ?? item.category?.imageUrl ?? item.product?.imageUrl ?? null;
}

function bannerAlt(item: HomepageItem): string {
  const name = item.heading ?? item.category?.name ?? item.collection?.name ?? item.product?.name;
  return name ? `${name} — BOX DIAMONDS jewellery` : 'BOX DIAMONDS jewellery';
}

function DuoCard({ item, index }: { item: HomepageItem; index: number }) {
  const href = linkFor(item);
  const image = imageFor(item);
  const style = image ? undefined : { background: placeholderGradient(index) };

  const content = (
    <>
      {image && <img src={image} alt={bannerAlt(item)} loading="lazy" decoding="async" />}
      <div className={styles.duoContent}>
        {item.heading && <p className={styles.duoTitle}>{item.heading}</p>}
        {item.subheading && <p className={styles.duoSubtitle}>{item.subheading}</p>}
        <span className={styles.duoCta}>Explore Now</span>
      </div>
    </>
  );

  return href ? (
    <Link to={href} className={styles.duoCard} style={style}>
      {content}
    </Link>
  ) : (
    <div className={styles.duoCard} style={style}>
      {content}
    </div>
  );
}

// Position-based, two-up landscape banner design — a second, visually
// distinct alternative to CollectionShowcase's 1-large+2-stacked layout.
// Used only when a section has exactly two items (e.g. "Shop by Occasion").
export function DuoBanner({ items }: { items: HomepageItem[] }) {
  return (
    <section className={styles.duoSection}>
      <div className={styles.duoGrid}>
        {items.map((item, i) => (
          <DuoCard key={item.id} item={item} index={i} />
        ))}
      </div>
    </section>
  );
}
