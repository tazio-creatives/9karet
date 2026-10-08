import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { productUrl } from '../../utils/productUrl';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './CollectionCarousel.module.css';

const AUTOPLAY_MS = 4500;

function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.collection) return `/collections/${item.collection.slug}`;
  if (item.category) return `/${item.category.slug}`;
  if (item.product) return productUrl({ slug: item.product.slug, categorySlug: null });
  return null;
}

// Shortest signed distance from the active slide, wrapping round — so the
// carousel loops forever in both directions.
function offsetFrom(index: number, active: number, count: number) {
  let d = index - active;
  if (d > count / 2) d -= count;
  if (d < -count / 2) d += count;
  return d;
}

// "Collections" carousel: square, image-only cards (artwork carries its own
// text); 3 visible on desktop with the centre one enlarged, 1 + peeks on
// mobile. Arrows, swipe and a gentle autoplay that pauses on hover/focus.
export function CollectionCarousel({
  items,
  heading,
  subheading,
  ctaLabel,
  ctaUrl,
}: {
  items: HomepageItem[];
  heading?: string | null;
  subheading?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}) {
  const count = items.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = useCallback((step: number) => setActive((a) => (a + step + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, paused, go]);

  if (count === 0) return null;

  return (
    <section className={styles.section} aria-roledescription="carousel" aria-label={heading || 'Collections'}>
      {heading && <h2 className={styles.heading}>{heading}</h2>}
      {subheading && <p className={styles.subheading}>{subheading}</p>}

      <div
        className={styles.stage}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
          setPaused(true);
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          setPaused(false);
          if (start === null) return;
          const dx = e.changedTouches[0].clientX - start;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        {items.map((item, i) => {
          const offset = count > 1 ? offsetFrom(i, active, count) : 0;
          const visible = Math.abs(offset) <= 1;
          const href = linkFor(item);
          const alt = item.heading ?? item.collection?.name ?? item.category?.name ?? '';
          const card = item.imageUrl ? (
            <img src={item.imageUrl} alt={alt} loading="lazy" decoding="async" />
          ) : (
            <span className={styles.placeholder} style={{ background: placeholderGradient(i) }} aria-hidden="true" />
          );
          return (
            <div
              key={item.id}
              className={`${styles.slide} ${offset === 0 ? styles.slideActive : ''}`}
              style={{ ['--offset' as string]: offset }}
              aria-hidden={!visible}
            >
              {href ? (
                <Link
                  to={href}
                  className={styles.card}
                  tabIndex={visible ? 0 : -1}
                  aria-label={alt || undefined}
                  onClick={(e) => {
                    // A side card first slides into the centre.
                    if (offset !== 0) {
                      e.preventDefault();
                      go(offset);
                    }
                  }}
                >
                  {card}
                </Link>
              ) : (
                <div className={styles.card}>{card}</div>
              )}
            </div>
          );
        })}

        {count > 1 && (
          <>
            <button type="button" className={`${styles.arrow} ${styles.prev}`} onClick={() => go(-1)} aria-label="Previous">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <path d="M15 4l-8 8 8 8" />
              </svg>
            </button>
            <button type="button" className={`${styles.arrow} ${styles.next}`} onClick={() => go(1)} aria-label="Next">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <path d="M9 4l8 8-8 8" />
              </svg>
            </button>
          </>
        )}
      </div>

      {ctaLabel && ctaUrl && (
        <div className={styles.ctaRow}>
          <Link to={ctaUrl} className={styles.cta}>
            {ctaLabel}
          </Link>
        </div>
      )}
    </section>
  );
}
