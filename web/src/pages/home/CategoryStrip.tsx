import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './CategoryStrip.module.css';

// Homepage "Category Strip": one row of rounded category photos with the
// name underneath, scrolling sideways on phones. The admin adds one item per
// category to show (Link to Category); the photo is the item's own upload,
// else the category's image. The label is the item's Heading, else the
// category name.
function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.category) return `/${item.category.slug}`;
  if (item.collection) return `/collections/${item.collection.slug}`;
  return null;
}

export function CategoryStrip({ items, heading }: { items: HomepageItem[]; heading?: string | null }) {
  const tiles = items.filter((item) => item.category || item.collection || item.ctaUrl);
  if (tiles.length === 0) return null;

  return (
    <section className={styles.section} aria-label={heading || 'Shop by category'}>
      {heading && <h2 className={styles.title}>{heading}</h2>}
      <div className={styles.row}>
        {tiles.map((item, i) => {
          const href = linkFor(item);
          const image = item.imageUrlMobile || item.imageUrl || item.category?.imageUrl || null;
          const label = item.heading || item.category?.name || item.collection?.name || '';
          const content = (
            <>
              <span className={styles.photo}>
                {image ? (
                  <img src={image} alt="" loading={i < 6 ? 'eager' : 'lazy'} decoding="async" />
                ) : (
                  <span className={styles.placeholder} style={{ background: placeholderGradient(i) }} />
                )}
              </span>
              <span className={styles.label}>{label}</span>
            </>
          );
          return href ? (
            <Link key={item.id} to={href} className={styles.tile} target={item.openInNewTab ? '_blank' : undefined}>
              {content}
            </Link>
          ) : (
            <span key={item.id} className={styles.tile}>
              {content}
            </span>
          );
        })}
      </div>
    </section>
  );
}
