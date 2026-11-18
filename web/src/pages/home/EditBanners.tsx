import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { productUrl } from '../../utils/productUrl';
import styles from './EditBanners.module.css';

function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.collection) return `/collections/${item.collection.slug}`;
  if (item.category) return `/${item.category.slug}`;
  if (item.product) return productUrl({ slug: item.product.slug, categorySlug: null });
  return null;
}

// Placeholders until images are uploaded: a soft cream for the first banner,
// deep velvet burgundy for the second — matching their text colours.
const PLACEHOLDERS = [
  'linear-gradient(120deg, #f8ede6 0%, #f1dfd5 55%, #e9cfc3 100%)',
  'linear-gradient(120deg, #4a0612 0%, #7a1024 55%, #5a0a18 100%)',
];

// "Collection Edit Banners": two wide banners side by side. Each has a small
// uppercase label, a serif title and a "Discover more ↗" link on the left.
// Banner 1 uses dark text (light image), banner 2 white text (dark image).
export function EditBanners({ items }: { items: HomepageItem[] }) {
  const banners = items.slice(0, 2);
  if (banners.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={`${styles.grid} ${banners.length === 1 ? styles.single : ''}`}>
        {banners.map((item, i) => {
          const href = linkFor(item) ?? '/jewellery';
          const title = item.heading || item.collection?.name || '';
          const theme = i % 2 === 0 ? styles.dark : styles.light;
          return (
            <Link
              key={item.id}
              to={href}
              className={`${styles.banner} ${theme}`}
              style={item.imageUrl ? undefined : { background: PLACEHOLDERS[i % 2] }}
              aria-label={title || item.subheading || 'Explore the collection'}
            >
              {item.imageUrl && (
                <picture className={styles.image}>
                  {item.imageUrlMobile && <source media="(max-width: 767px)" srcSet={item.imageUrlMobile} />}
                  <img src={item.imageUrl} alt="" loading="lazy" decoding="async" />
                </picture>
              )}
              {/* Text is optional: when the uploaded image already has its
                  own wording, leave Heading / Subheading / CTA Label empty
                  and only the image shows. */}
              {(item.heading || item.subheading || item.ctaLabel) && (
                <span className={styles.text}>
                  {item.subheading && <span className={styles.eyebrow}>{item.subheading}</span>}
                  {item.heading && <span className={styles.title}>{item.heading}</span>}
                  <span className={styles.cta}>
                    {item.ctaLabel || 'Discover more'} <span aria-hidden="true">↗</span>
                  </span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
