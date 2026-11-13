import { useState, type KeyboardEvent } from 'react';
import type { ProductDetail } from '../../api/types';
import { ReviewsSection } from './ReviewsSection';
import styles from './ProductTabs.module.css';

type TabId = 'description' | 'reviews';

export function ProductTabs({ product }: { product: ProductDetail }) {
  const hasDescription = !!product.fullDescription || !!product.careInstructions;
  const hasReviews = product.ratingCount > 0;

  const tabs: { id: TabId; label: string }[] = [
    ...(hasDescription ? [{ id: 'description' as const, label: 'Description' }] : []),
    ...(hasReviews ? [{ id: 'reviews' as const, label: `Reviews (${product.ratingCount})` }] : []),
  ];

  const [active, setActive] = useState<TabId>(tabs[0]?.id ?? 'description');

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = tabs.findIndex((t) => t.id === active);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActive(tabs[(currentIndex + 1) % tabs.length].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive(tabs[(currentIndex - 1 + tabs.length) % tabs.length].id);
    }
  }

  // Nothing to show at all — skip the card entirely rather than rendering
  // an empty shell.
  if (tabs.length === 0) return null;

  return (
    <div className={styles.wrap}>
      {tabs.length > 1 ? (
        <div className={styles.tabListWrap}>
          <div className={styles.tabList} role="tablist" aria-label="Product information" onKeyDown={handleKeyDown}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`pdp-tab-${tab.id}`}
                aria-selected={active === tab.id}
                aria-controls={`pdp-panel-${tab.id}`}
                tabIndex={active === tab.id ? 0 : -1}
                className={active === tab.id ? styles.tabActive : styles.tab}
                onClick={() => setActive(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        // Only one section exists (e.g. no description text, just reviews)
        // — the interactive tab strip has nothing to switch between, but
        // the section still needs its own visible heading instead of
        // rendering with no label at all.
        <h2 className={styles.singleHeading}>{tabs[0].label}</h2>
      )}

      {hasDescription && (
        <div
          role={tabs.length > 1 ? 'tabpanel' : undefined}
          id="pdp-panel-description"
          aria-labelledby={tabs.length > 1 ? 'pdp-tab-description' : undefined}
          hidden={active !== 'description'}
          className={styles.panel}
        >
          {product.fullDescription && <p className={styles.description}>{product.fullDescription}</p>}
          {product.careInstructions && (
            <>
              <h3 className={styles.subheading}>Care Instructions</h3>
              <p className={styles.description}>{product.careInstructions}</p>
            </>
          )}
        </div>
      )}

      {hasReviews && (
        <div
          role={tabs.length > 1 ? 'tabpanel' : undefined}
          id="pdp-panel-reviews"
          aria-labelledby={tabs.length > 1 ? 'pdp-tab-reviews' : undefined}
          hidden={active !== 'reviews'}
          className={styles.panel}
        >
          <ReviewsSection productId={product.id} />
        </div>
      )}
    </div>
  );
}
