import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { formatPrice } from '../../utils/formatPrice';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './CategoryProductRow.module.css';

function TagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M20.5 12.5L12.5 20.5a1.5 1.5 0 0 1-2.1 0l-7-7a1.5 1.5 0 0 1 0-2.1L11.4 3.4a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v6.6a2 2 0 0 1-.5 1.5z" strokeLinejoin="round" />
      <circle cx="16" cy="7" r="1.5" />
    </svg>
  );
}

function materialFor(product: { metalType: string | null; purity: string | null }): string | null {
  if (!product.metalType) return null;
  return `${product.purity ?? '9K'} Gold`;
}

// One category's block: an image+name tile leading the same row as its top
// 5 products (no carousel — the count is fixed, unlike ProductCarousel),
// then a View All button. A section can list several of these stacked.
function CategoryBlock({ item, index }: { item: HomepageItem; index: number }) {
  const category = item.category;
  if (!category || item.products.length === 0) return null;

  return (
    <div className={styles.categoryBlock}>
      <div className={styles.productRow}>
        <Link to={`/${category.slug}`} className={styles.categoryTile}>
          {category.imageUrl ? (
            <img src={category.imageUrl} alt={category.name} loading="lazy" decoding="async" />
          ) : (
            <div className={styles.categoryTilePlaceholder} style={{ background: placeholderGradient(index) }} />
          )}
          <div className={styles.categoryTileOverlay}>
            <p className={styles.categoryTileName}>{category.name}</p>
          </div>
        </Link>

        {item.products.slice(0, 5).map((product, i) => {
          const material = materialFor(product);
          const strikePrice = product.strikePrice;
          return (
            <Link
              key={product.id}
              to={product.categorySlug ? `/${product.categorySlug}/${product.slug}` : `/${product.slug}`}
              className={styles.productCard}
            >
              <div className={styles.productImageWrapper}>
                {product.primaryImageUrl ? (
                  <img src={product.primaryImageUrl} alt={product.name} loading="lazy" decoding="async" />
                ) : (
                  <div className={styles.productImagePlaceholder} style={{ background: placeholderGradient(i) }} />
                )}
              </div>
              <div className={styles.productInfo}>
                <h4 className={styles.productName}>{product.name}</h4>
                {material && <p className={styles.productMaterial}>{material}</p>}
                <p className={styles.productPrice}>
                  {formatPrice(product.sellingPrice)}
                  {strikePrice > 0 && <span className={styles.productMrp}>{formatPrice(strikePrice)}</span>}
                </p>
                {(product.offerBadges.length > 0 || product.offerLabel) && (
                  <div className={styles.offerBanner}>
                    <span className={styles.offerBannerLeft}>
                      <span className={styles.offerBannerIcon}>
                        <TagIcon />
                      </span>
                      {product.offerBadges.length > 0 ? (
                        <span className={styles.offerBannerHeadlineGroup}>
                          {product.offerBadges.map((badge) => (
                            <span key={badge.type} className={styles.offerBannerHeadline}>
                              {badge.label}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className={styles.offerBannerHeadline}>{product.offerLabel}</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <Link to={`/${category.slug}`} className={styles.viewAllButton}>
        View All {category.name}
      </Link>
    </div>
  );
}

export function CategoryProductRow({ items, heading }: { items: HomepageItem[]; heading?: string | null }) {
  const blocks = items.filter((item) => item.category && item.products.length > 0);
  if (blocks.length === 0) return null;

  return (
    <section className={styles.categorySection}>
      {heading && <h2 className={styles.sectionHeading}>{heading}</h2>}
      {blocks.map((item, i) => (
        <CategoryBlock key={item.id} item={item} index={i} />
      ))}
    </section>
  );
}
