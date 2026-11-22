import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HomepageItem, ProductCard as ProductCardType } from '../../api/types';
import { QuickAddSheet } from '../../features/plp/QuickAddSheet';
import { useQuickAdd } from '../../features/plp/useQuickAdd';
import { TabProductCard } from './ProductTabsSection';
import styles from './ProductRowSection.module.css';

// Homepage "Product Row": centred heading + short description, then one
// sideways-scrolling row of product cards (same cards as Product Tabs) from
// the category or collection picked on the section's first item.
export function ProductRowSection({
  items,
  heading,
  subheading,
}: {
  items: HomepageItem[];
  heading?: string | null;
  subheading?: string | null;
}) {
  const source = items[0];
  const products = source?.products ?? [];
  if (!source || products.length === 0) return null;

  const viewAllHref = source.collection
    ? `/collections/${source.collection.slug}`
    : source.category
      ? `/${source.category.slug}`
      : source.ctaUrl || '/products';

  return (
    <ProductCarouselRow
      title={heading}
      subtitle={subheading}
      products={products}
      viewAllHref={viewAllHref}
      viewAllLabel={source.ctaLabel || 'View all'}
      hideNewTag
    />
  );
}

// One sideways-scrolling row of homepage product cards with a title, an
// optional subtitle and "View all" link. Arrows on desktop when there is
// more to see; swipe on phones. Used by the homepage Product Row and the
// product page's related-product rows.
export function ProductCarouselRow({
  title,
  subtitle,
  products,
  viewAllHref,
  viewAllLabel = 'View all',
  align = 'center',
  hideNewTag = false,
}: {
  title?: string | null;
  subtitle?: string | null;
  products: ProductCardType[];
  viewAllHref?: string | null;
  viewAllLabel?: string;
  align?: 'center' | 'left';
  hideNewTag?: boolean;
}) {
  const quickAdd = useQuickAdd();
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
  }, [products.length]);

  if (products.length === 0) return null;

  // Scroll by one visible "page" of cards.
  function scrollPage(dir: 1 | -1) {
    const el = rowRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  }

  return (
    <section className={styles.section} aria-label={title || 'Products'}>
      <div className={align === 'left' ? `${styles.header} ${styles.headerLeft}` : styles.header}>
        {title && <h2 className={styles.title}>{title}</h2>}
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {viewAllHref && (
          <Link to={viewAllHref} className={styles.viewAll}>
            {viewAllLabel} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>

      <div className={styles.rowWrap}>
        <div className={styles.row} ref={rowRef}>
          {products.map((product, i) => (
            <div key={product.id} className={styles.slot}>
              <TabProductCard
                product={product}
                index={i}
                hideNewTag={hideNewTag}
                onAdd={() => quickAdd.addToCart(product)}
                isAdding={quickAdd.pendingProductId === product.id}
                justAdded={quickAdd.justAddedProductId === product.id}
                hasError={quickAdd.errorProductId === product.id}
              />
            </div>
          ))}
        </div>
        {canPrev && (
          <button type="button" className={`${styles.arrow} ${styles.arrowPrev}`} aria-label="Previous products" onClick={() => scrollPage(-1)}>
            <Chevron direction="left" />
          </button>
        )}
        {canNext && (
          <button type="button" className={`${styles.arrow} ${styles.arrowNext}`} aria-label="More products" onClick={() => scrollPage(1)}>
            <Chevron direction="right" />
          </button>
        )}
      </div>

      {quickAdd.sheetProduct && <QuickAddSheet product={quickAdd.sheetProduct} onClose={quickAdd.closeSheet} />}
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
