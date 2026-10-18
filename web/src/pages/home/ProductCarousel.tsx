import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { WishlistButton } from '../../components/WishlistButton';
import { formatPrice } from '../../utils/formatPrice';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './ProductCarousel.module.css';

const AUTO_ADVANCE_MS = 4500;

function TagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M20.5 12.5L12.5 20.5a1.5 1.5 0 0 1-2.1 0l-7-7a1.5 1.5 0 0 1 0-2.1L11.4 3.4a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v6.6a2 2 0 0 1-.5 1.5z" strokeLinejoin="round" />
      <circle cx="16" cy="7" r="1.5" />
    </svg>
  );
}

// Matches the desktop/tablet/mobile breakpoints in the CSS module — mobile
// falls back to native touch scroll instead of JS paging (see .productSlider
// in ProductCarousel.module.css), so it isn't one of these states. Desktop
// count is configurable per section (Featured Products wants 3-per-row,
// New Arrivals wants 5); tablet/mobile stay fixed since neither caller
// asked to change those.
function useCardsPerView(desktopCount: number) {
  const [cardsPerView, setCardsPerView] = useState(desktopCount);
  useEffect(() => {
    function update() {
      if (window.innerWidth < 768) setCardsPerView(1);
      else if (window.innerWidth < 1200) setCardsPerView(3);
      else setCardsPerView(desktopCount);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [desktopCount]);
  return cardsPerView;
}

function materialFor(product: NonNullable<HomepageItem['product']>): string | null {
  if (!product.metalType) return null;
  return `${product.purity ?? '9K'} Gold`;
}

// Generic multi-product carousel row — shared by NEW_ARRIVALS and
// FEATURED_PRODUCT homepage sections (both are "auto-synced from Products"
// lists, see homepage.repository.js). heading/viewAllHref/cardsPerView are
// supplied by the caller per section rather than hardcoded here, since the
// two section types need different defaults and FEATURED_PRODUCT has no
// "view all" page.
interface ProductCarouselProps {
  items: HomepageItem[];
  heading: string;
  viewAllHref?: string;
  cardsPerViewDesktop?: number;
}

export function ProductCarousel({ items, heading, viewAllHref, cardsPerViewDesktop = 5 }: ProductCarouselProps) {
  const cardsPerView = useCardsPerView(cardsPerViewDesktop);
  const [page, setPage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const totalPages = Math.max(1, Math.ceil(items.length / cardsPerView));
  const clampedPage = Math.min(page, totalPages - 1);

  // Auto-advance, paused on hover so a shopper reading a card isn't fought
  // by the carousel — loops back to page 0 after the last page.
  const totalPagesRef = useRef(totalPages);
  totalPagesRef.current = totalPages;
  useEffect(() => {
    if (totalPages <= 1 || isHovered) return undefined;
    const id = setInterval(() => {
      setPage((p) => (p + 1) % totalPagesRef.current);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [totalPages, isHovered]);

  if (items.length === 0) return null;

  return (
    <section
      className={styles.newArrivalsSection}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={styles.newArrivalsHeader}>
        <h2 className={styles.newArrivalsTitle}>{heading}</h2>
        {viewAllHref && (
          <Link to={viewAllHref} className={styles.viewAllLink}>
            View All →
          </Link>
        )}
      </div>

      <div className={styles.productSlider}>
        <div
          className={styles.productTrack}
          style={
            {
              transform: `translateX(-${clampedPage * 100}%)`,
              '--cards-per-view': cardsPerViewDesktop,
            } as CSSProperties
          }
        >
          {items.map((item, i) => {
            const product = item.product;
            if (!product) return null;
            const material = materialFor(product);
            const strikePrice = product.strikePrice;
            return (
              <Link key={item.id} to={item.ctaUrl ?? `/${product.slug}`} className={styles.productCard}>
                <div className={styles.productImageWrapper}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" />
                  ) : (
                    <div className={styles.productImagePlaceholder} style={{ background: placeholderGradient(i) }} />
                  )}
                  <WishlistButton productId={product.id} className={styles.wishlistButton} />
                </div>
                <div className={styles.productInfo}>
                  <h3 className={styles.productName}>{product.name}</h3>
                  {material && <p className={styles.productMaterial}>{material}</p>}
                  <p className={styles.productPrice}>
                    {formatPrice(product.sellingPrice)}
                    {strikePrice > 0 && (
                      <span className={styles.productMrp}>{formatPrice(strikePrice)}</span>
                    )}
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
      </div>

      {totalPages > 1 && (
        <div className={styles.carouselDots}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.carouselDot} ${i === clampedPage ? styles.active : ''}`}
              aria-label={`Show page ${i + 1}`}
              onClick={() => setPage(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
