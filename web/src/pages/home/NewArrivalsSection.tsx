import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { ProductCard } from '../../components/ProductCard';
import styles from './NewArrivalsSection.module.css';

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Decorative line-art watermark for the feature banner — no real jewellery
// photograph asset exists in this repo (only favicon/logo/auth-hero.jpg are
// available), so the banner uses a designed warm-gradient ground plus this
// SVG motif instead of a photo. Swap in a real photograph via `.bannerArt`'s
// background-image whenever one is supplied.
function BannerArt() {
  return (
    <svg className={styles.bannerArtSvg} viewBox="0 0 260 260" fill="none" aria-hidden="true">
      <circle cx="190" cy="90" r="70" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="190" cy="90" r="46" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <path d="M60 220 Q160 160 230 210" stroke="currentColor" strokeWidth="1" opacity="0.5" fill="none" />
      <path d="M40 190 Q150 120 245 175" stroke="currentColor" strokeWidth="1" opacity="0.35" fill="none" />
    </svg>
  );
}

// Redesigned New Arrivals: a 31%/69% feature-banner + product-carousel row
// (reference mockup), replacing the old plain ProductCarousel usage for
// this section only. The backend now returns one auto item whose
// `.products` array is the newest published products in the full
// ProductCard DTO shape (see homepage.repository.js) — same shape the PLP
// uses — so the existing ProductCard component is reused here directly
// instead of hand-rolled card markup or price math.
const MOBILE_BREAKPOINT = '(max-width: 767px)';

export function NewArrivalsSection({ items }: { items: HomepageItem[] }) {
  const item = items[0];
  const products = (item?.products ?? []).slice(0, 10);
  const bannerImage = item?.imageUrl ?? null;
  const bannerImageMobile = item?.imageUrlMobile ?? null;
  const bannerTitle = item?.heading || 'New Arrivals';
  const bannerSubtitle = item?.subheading || 'From festive sparkle to everyday essentials';
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;

    function updateScrollState() {
      const node = trackRef.current;
      if (!node) return;
      const page = node.clientWidth || 1;
      const maxScroll = node.scrollWidth - node.clientWidth;
      setCanScrollPrev(node.scrollLeft > 4);
      setCanScrollNext(node.scrollLeft < maxScroll - 4);
      setPageCount(Math.max(1, Math.round(node.scrollWidth / page)));
      setActiveIndex(Math.round(node.scrollLeft / page));
    }

    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [products.length]);

  function scrollByPage(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
  }

  function scrollToPage(index: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  }

  if (products.length === 0) return null;

  return (
    <section className={styles.section} aria-label="New Arrivals">
      <div className={styles.banner}>
        {bannerImage ? (
          <picture>
            {bannerImageMobile && <source media={MOBILE_BREAKPOINT} srcSet={bannerImageMobile} />}
            <img
              src={bannerImage}
              alt="New arrivals in 9K gold jewellery — 9KARET"
              className={styles.bannerImg}
              loading="lazy"
              decoding="async"
            />
          </picture>
        ) : (
          <BannerArt />
        )}
        <div className={styles.bannerScrim} aria-hidden="true" />
        <div className={styles.bannerCopy}>
          <p className={styles.bannerTitle}>{bannerTitle}</p>
          <p className={styles.bannerSubtitle}>{bannerSubtitle}</p>
        </div>
      </div>

      <div className={styles.productArea}>
        <div className={styles.productHeader}>
          <div>
            <h2 className={styles.heading}>Latest Introductions</h2>
            <p className={styles.description}>Discover our newest 9K gold designs.</p>
          </div>
          <Link to="/new-arrivals?sort=newest" className={styles.viewAllLink}>
            View All →
          </Link>
        </div>

        <div className={styles.carouselWrap}>
          {canScrollPrev && (
            <button
              type="button"
              className={`${styles.navButton} ${styles.navPrev}`}
              aria-label="Previous products"
              onClick={() => scrollByPage(-1)}
            >
              <ArrowIcon direction="left" />
            </button>
          )}

          <div className={styles.productTrack} ref={trackRef}>
            {products.map((product, i) => (
              <div className={styles.slide} key={product.id}>
                <ProductCard product={product} index={i} />
              </div>
            ))}
          </div>

          {canScrollNext && (
            <button
              type="button"
              className={`${styles.navButton} ${styles.navNext}`}
              aria-label="Next products"
              onClick={() => scrollByPage(1)}
            >
              <ArrowIcon direction="right" />
            </button>
          )}
        </div>

        {pageCount > 1 && (
          <div className={styles.dots}>
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.dot} ${i === activeIndex ? styles.dotActive : ''}`}
                aria-label={`Show product group ${i + 1}`}
                onClick={() => scrollToPage(i)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
