import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { placeholderGradient } from '../../utils/placeholderGradient';
import styles from './CollectionSpotlight.module.css';

// One tall collection card: portrait image (or a rich gradient until one is
// uploaded), with the collection name in a serif face and a short line
// underneath, over a soft dark fade at the bottom. Shared by the homepage
// "Our Collections" section and the /collections page.
export function CollectionCard({
  href,
  name,
  tagline,
  imageUrl,
  imageUrlMobile,
  index,
  className,
}: {
  href: string;
  name: string;
  tagline?: string | null;
  imageUrl?: string | null;
  imageUrlMobile?: string | null;
  index: number;
  className?: string;
}) {
  return (
    <Link to={href} className={`${styles.card} ${className ?? ''}`}>
      {imageUrl ? (
        <picture className={styles.cardImage}>
          {imageUrlMobile && <source media="(max-width: 767px)" srcSet={imageUrlMobile} />}
          <img src={imageUrl} alt={`${name} collection`} loading="lazy" decoding="async" />
        </picture>
      ) : (
        <span className={styles.cardImage} style={{ background: placeholderGradient(index) }} aria-hidden="true" />
      )}
      <span className={styles.cardShade} aria-hidden="true" />
      <span className={styles.cardText}>
        <span className={styles.cardName}>{name}</span>
        {tagline && <span className={styles.cardTagline}>{tagline}</span>}
      </span>
    </Link>
  );
}

// Homepage "Our Collections": centred title, a sideways-scrolling row of
// tall collection cards (arrows on desktop when there's more to see).
// One admin item per collection.
export function CollectionSpotlight({
  items,
  heading,
}: {
  items: HomepageItem[];
  heading?: string | null;
}) {
  const cards = items
    .map((item) => {
      const href = item.collection ? `/collections/${item.collection.slug}` : item.ctaUrl || item.redirectUrl;
      const name = item.heading || item.collection?.name;
      return href && name ? { item, href, name } : null;
    })
    .filter((c): c is { item: HomepageItem; href: string; name: string } => c !== null);

  const rowRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const update = () => {
      setCanPrev(el.scrollLeft > 4);
      setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [cards.length]);

  function scrollByCard(dir: 1 | -1) {
    const el = rowRef.current;
    const card = el?.querySelector<HTMLElement>(`.${styles.card}`);
    if (!el || !card) return;
    el.scrollBy({ left: dir * (card.offsetWidth + 20), behavior: 'smooth' });
  }

  if (cards.length === 0) return null;
  const title = heading || '9Karet Collections';

  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>

      <div className={styles.rowWrap}>
        <div className={styles.row} ref={rowRef}>
          {cards.map(({ item, href, name }, i) => (
            <CollectionCard
              key={item.id}
              href={href}
              name={name}
              tagline={item.subheading}
              imageUrl={item.imageUrl}
              imageUrlMobile={item.imageUrlMobile}
              index={i}
            />
          ))}
        </div>
        {canPrev && (
          <button type="button" className={`${styles.arrow} ${styles.arrowPrev}`} aria-label="Previous collections" onClick={() => scrollByCard(-1)}>
            <Chevron direction="left" />
          </button>
        )}
        {canNext && (
          <button type="button" className={`${styles.arrow} ${styles.arrowNext}`} aria-label="More collections" onClick={() => scrollByCard(1)}>
            <Chevron direction="right" />
          </button>
        )}
      </div>
    </section>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

// Plain grid of collection cards — used by the /collections page.
export function CollectionGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
