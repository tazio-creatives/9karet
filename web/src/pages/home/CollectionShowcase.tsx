import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { productUrl } from '../../utils/productUrl';
import styles from './CollectionShowcase.module.css';

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
  const name = item.heading ?? item.collection?.name ?? item.category?.name ?? item.product?.name;
  return name ? `${name} — BOX DIAMONDS jewellery` : 'BOX DIAMONDS jewellery';
}

function CollectionCard({ item, large }: { item: HomepageItem; large?: boolean }) {
  const href = linkFor(item);
  const image = imageFor(item);
  const cardClass = `${styles.collectionCard} ${large ? styles.collectionCardLarge : ''}`;

  const content = (
    <>
      {image && <img src={image} alt={bannerAlt(item)} loading="lazy" decoding="async" />}
      <div className={styles.collectionContent}>
        {item.heading && <p className={styles.collectionTitle}>{item.heading}</p>}
        {item.subheading && <p className={styles.collectionDescription}>{item.subheading}</p>}
        <span className={styles.collectionLink}>Explore →</span>
      </div>
    </>
  );

  return href ? (
    <Link to={href} className={cardClass}>
      {content}
    </Link>
  ) : (
    <div className={cardClass}>{content}</div>
  );
}

// Position-based composition (plan §... homepage bento pattern): item[0] is
// always the large left banner, item[1]/item[2] stack on the right — never
// matched by heading/title, only by array index, so admins can point any
// three items at this section and the layout still holds.
export function CollectionShowcase({ items }: { items: HomepageItem[] }) {
  const [main, top, bottom] = items;
  return (
    <section className={styles.collectionSection}>
      <div className={styles.collectionGrid}>
        <CollectionCard item={main} large />
        <div className={styles.collectionStack}>
          <CollectionCard item={top} />
          <CollectionCard item={bottom} />
        </div>
      </div>
    </section>
  );
}
