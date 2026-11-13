import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './DetailsCard.module.css';

const COLLAPSED_HEIGHT = 240;

interface DetailsCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

// Both PDP detail cards (Product Details / Price Breakup) share this so they
// always render at the same height — whichever has more rows gets clipped
// with a "View More" toggle instead of stretching the shorter card's box.
export function DetailsCard({ title, children, className }: DetailsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (el) setOverflowing(el.scrollHeight > COLLAPSED_HEIGHT + 1);
  }, [children]);

  // Mobile's accordion (DetailsCard.module.css) starts fully collapsed by
  // default like any other accordion — but on the product detail page these
  // two cards are the actual product data, worth showing open by default.
  // Client-only (matchMedia isn't available during SSR) so this can't cause
  // a hydration mismatch; it just flips open right after mount on mobile.
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setExpanded(true);
  }, []);

  return (
    <section className={className ? `${styles.card} ${className}` : styles.card}>
      <button
        type="button"
        className={styles.heading}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {title}
        <svg
          className={expanded ? styles.headingChevronOpen : styles.headingChevron}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        ref={contentRef}
        className={`${styles.content} ${expanded ? styles.contentExpanded : ''} ${!expanded && overflowing ? styles.fade : ''}`}
      >
        {children}
      </div>
      {overflowing && (
        <button type="button" className={styles.toggle} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'View Less' : 'View More'}
        </button>
      )}
    </section>
  );
}
