import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { productUrl } from '../../utils/productUrl';
import styles from './ShopByBudget.module.css';

function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.collection) return `/collections/${item.collection.slug}`;
  if (item.category) return `/${item.category.slug}`;
  if (item.product) return productUrl({ slug: item.product.slug, categorySlug: null });
  return null;
}

// Placeholder backgrounds until photos are uploaded: soft, slightly moody
// tones in the spirit of the reference (stone, sage, amber, teal).
const PLACEHOLDERS = [
  'linear-gradient(160deg, #8d8a86 0%, #5f5c59 100%)',
  'linear-gradient(160deg, #a9b49a 0%, #6f7d63 100%)',
  'linear-gradient(160deg, #b8873a 0%, #7a5418 100%)',
  'linear-gradient(160deg, #4f7488 0%, #2d4a5a 100%)',
];

// "Shop by Budget" / "Shop by Bond": centred title + grey subtitle, then a
// row of square photo cards with the label ("Under 10k", "Mother") written
// bottom-left in white. One admin item per card; the item Heading is the
// label. Up to 6 cards share one row on desktop.
export function ShopByBudget({
  items,
  heading,
  subheading,
  defaultTitle = 'Shop by Budget',
}: {
  items: HomepageItem[];
  heading?: string | null;
  subheading?: string | null;
  defaultTitle?: string;
}) {
  if (items.length === 0) return null;
  const title = heading || defaultTitle;
  const cols = Math.min(items.length, 6);

  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      {subheading && <p className={styles.subtitle}>{subheading}</p>}

      <div className={styles.grid} style={{ '--cols': cols } as CSSProperties}>
        {items.map((item, i) => {
          const href = linkFor(item);
          const label = item.heading ?? item.collection?.name ?? item.category?.name ?? '';
          const content = (
            <>
              {item.imageUrl ? (
                <picture className={styles.image}>
                  {item.imageUrlMobile && <source media="(max-width: 767px)" srcSet={item.imageUrlMobile} />}
                  <img src={item.imageUrl} alt={item.subheading || `9K gold jewellery — ${label}`} loading="lazy" decoding="async" />
                </picture>
              ) : (
                <span className={styles.image} style={{ background: PLACEHOLDERS[i % PLACEHOLDERS.length] }} aria-hidden="true" />
              )}
              <span className={styles.shade} aria-hidden="true" />
              {label && <span className={styles.label}>{label}</span>}
            </>
          );
          return href ? (
            <Link key={item.id} to={href} className={styles.card}>
              {content}
            </Link>
          ) : (
            <div key={item.id} className={styles.card}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
