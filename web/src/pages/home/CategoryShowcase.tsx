import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageItem } from '../../api/types';
import { CategoryProductGrid } from './CategoryProductGrid';
import styles from './CategoryShowcase.module.css';

// The panel id every category tile's aria-controls points at — one fixed id
// since only one CategoryShowcase instance exists per homepage render.
const PRODUCTS_PANEL_ID = 'home-category-products-panel';

function linkFor(item: HomepageItem): string | null {
  if (item.ctaUrl) return item.ctaUrl;
  if (item.category) return `/${item.category.slug}`;
  if (item.collection) return `/collections/${item.collection.slug}`;
  return null;
}

function imageFor(item: HomepageItem): string | null {
  return item.imageUrl ?? item.category?.imageUrl ?? null;
}

function nameFor(item: HomepageItem): string | null {
  return item.category?.name ?? item.heading;
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={direction === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
    </svg>
  );
}

// Shown in place of a blank tinted box when a category has no image of its
// own configured yet (mobile-only — see .imagePlaceholder's media query;
// desktop keeps its prior blank-box appearance untouched).
function PlaceholderIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M2 9h20M9 3l3 6-3 12M15 3l-3 6 3 12" />
    </svg>
  );
}

function CategoryCard({
  item,
  isSelected,
  onSelect,
}: {
  item: HomepageItem;
  isSelected: boolean;
  onSelect: (item: HomepageItem) => void;
}) {
  const imageUrl = imageFor(item);
  const name = nameFor(item);

  const content = (
    <>
      <div className={styles.imageWrapper}>
        {/* subheading doubles as an optional promo tag ("Special") on a tile — no
            dedicated badge field exists on HomepageItem, and this one is already
            unused elsewhere in this section. */}
        {item.subheading && <span className={styles.badge}>{item.subheading}</span>}
        {imageUrl ? (
          <img src={imageUrl} alt={`${name} — 9KARET jewellery`} loading="lazy" decoding="async" />
        ) : (
          <span className={styles.imagePlaceholder} aria-hidden="true">
            <PlaceholderIcon />
          </span>
        )}
      </div>
      {name && <p className={styles.cardName}>{name}</p>}
    </>
  );

  // A real category tile selects and loads products in-place below (per the
  // in-place product browsing feature) rather than navigating away — a
  // non-category tile (e.g. a pure collection/CTA promo, which has nothing
  // to select products by) keeps its original navigate-away link behaviour.
  if (!item.category) {
    const href = linkFor(item);
    return href ? (
      <Link to={href} className={styles.categoryCard}>
        {content}
      </Link>
    ) : (
      <div className={styles.categoryCard}>{content}</div>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.categoryCard} ${isSelected ? styles.categoryCardActive : ''}`}
      aria-selected={isSelected}
      aria-controls={PRODUCTS_PANEL_ID}
      onClick={() => onSelect(item)}
    >
      {content}
    </button>
  );
}

interface CategoryShowcaseProps {
  items: HomepageItem[];
  heading?: string | null;
}

// Horizontal scrollable strip of circular-ish category tiles with left/right
// nav arrows — replaces the earlier fixed-6-item asymmetric bento grid.
// Renders for any item count (no longer position-locked to 6).
export function CategoryShowcase({ items, heading }: CategoryShowcaseProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  // No "configured default category" concept exists in the homepage data
  // model today — falls back directly to "the first active category" (every
  // BENTO_CATEGORIES item is already an active category tile server-side),
  // satisfying the DEFAULT CATEGORY rule's fallback branch.
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () => items.find((i) => i.category)?.id ?? null,
  );

  function updateScrollState() {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  function scrollByPage(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * trackRef.current.clientWidth * 0.7, behavior: 'smooth' });
  }

  if (items.length === 0) return null;

  const selectedItem = items.find((i) => i.id === selectedItemId && i.category) ?? items.find((i) => i.category) ?? null;

  return (
    <div className={styles.categorySection}>
      {heading && <h2 className={styles.heading}>{heading}</h2>}
      <div className={styles.scrollerWrapper}>
        {canScrollLeft && (
          <button
            type="button"
            className={`${styles.navButton} ${styles.navLeft}`}
            onClick={() => scrollByPage(-1)}
            aria-label="Scroll categories left"
          >
            <ChevronIcon direction="left" />
          </button>
        )}
        <div className={styles.categoryTrack} ref={trackRef} onScroll={updateScrollState}>
          {items.map((item) => (
            <CategoryCard
              key={item.id}
              item={item}
              isSelected={item.id === selectedItem?.id}
              onSelect={(selected) => setSelectedItemId(selected.id)}
            />
          ))}
        </div>
        {canScrollRight && (
          <button
            type="button"
            className={`${styles.navButton} ${styles.navRight}`}
            onClick={() => scrollByPage(1)}
            aria-label="Scroll categories right"
          >
            <ChevronIcon direction="right" />
          </button>
        )}
      </div>
      {selectedItem?.category && (
        <CategoryProductGrid
          key={selectedItem.category.id}
          panelId={PRODUCTS_PANEL_ID}
          categorySlug={selectedItem.category.slug}
          categoryName={selectedItem.category.name}
        />
      )}
    </div>
  );
}
