import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { fetchProducts } from '../../api/products';
import { ProductCard } from '../../components/ProductCard';
import { placeholderGradient } from '../../utils/placeholderGradient';
import { useFixedProducts } from './useFixedProducts';
import styles from './CollectionProductShowcase.module.css';

// Kept in sync with the media query in CollectionProductShowcase.module.css
// (same convention as HeroCarousel.tsx) — the <source> breakpoint here must
// match the CSS one, or the browser and the layout would switch banner
// images at different widths.
const MOBILE_BREAKPOINT = '(max-width: 767px)';

// One collection banner + a fixed batch of that collection's products,
// sharing a single continuous container (plan: "banner and all products
// must feel like one continuous collection section"). A COLLECTION_SHOWCASE
// section is meant to carry exactly one item — if an admin adds more, only
// the first renders (see the matching admin hint in HomepagePage.tsx).
// Product loading is a fixed batch of 15 (useFixedProducts, shared with
// CategoryProductGrid.tsx) — mobile shows only the first 8 of it via CSS
// (2 columns x 4 rows), desktop shows all 15 (5 columns x 3 rows). A View
// All button always follows the grid instead of paginating further.
export function CollectionProductShowcase({ items }: { items: HomepageItem[] }) {
  const item = items[0];

  const { products, isLoading, error } = useFixedProducts({
    initialProducts: item?.products ?? [],
    fetchPage: async (limit) => {
      const result = await fetchProducts({ collection: item?.collection?.slug, page: 1, limit, placement: 'homepage' });
      return { products: result.products, total: result.total };
    },
  });

  if (!item || !item.collection) return null;

  const { collection } = item;
  const href = `/collections/${collection.slug}`;

  return (
    <section className={styles.showcase} aria-label={collection.name}>
      <Link to={href} className={styles.banner} aria-label={`Explore ${collection.name}`}>
        {item.imageUrl ? (
          <picture>
            {item.imageUrlMobile && <source media={MOBILE_BREAKPOINT} srcSet={item.imageUrlMobile} />}
            <img
              src={item.imageUrl}
              alt={`${collection.name} collection — 9KARET`}
              className={styles.bannerImg}
              loading="lazy"
              decoding="async"
            />
          </picture>
        ) : (
          <div className={styles.bannerImg} style={{ background: placeholderGradient(0) }} aria-hidden="true" />
        )}
        <div className={styles.scrim} aria-hidden="true" />

        <div className={styles.bannerCopy}>
          {item.heading && <p className={styles.eyebrow}>{item.heading}</p>}
          {item.subheading && <p className={styles.description}>{item.subheading}</p>}
        </div>
      </Link>

      <div className={styles.productArea}>
        {/* Whatever's currently in state — an SSR-seeded batch smaller than
            the full 15 stays visible while a background top-up fetch runs,
            rather than blanking out already-good data; loading/error only
            gate the true empty case. */}
        {products.length > 0 ? (
          <>
            <div className={styles.productGrid}>
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} imagePadding={false} flat />
              ))}
            </div>

            <div className={styles.actionRow}>
              <Link to={href} className={styles.viewAllButton}>
                View All {collection.name}
              </Link>
            </div>
          </>
        ) : isLoading ? null : error ? (
          <p className={styles.empty}>Couldn&apos;t load products for this collection.</p>
        ) : (
          <p className={styles.empty}>No products in this collection yet.</p>
        )}
      </div>
    </section>
  );
}
