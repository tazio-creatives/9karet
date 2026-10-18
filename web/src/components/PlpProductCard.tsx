import { productImageAlt } from '../seo/productSeo';
import { Link } from 'react-router-dom';
import type { ProductCard as ProductCardType } from '../api/types';
import { productUrl } from '../utils/productUrl';
import { formatPrice } from '../utils/formatPrice';
import { placeholderGradient } from '../utils/placeholderGradient';
import { getStockStatus } from '../utils/stockStatus';
import { COLOR_SWATCH } from '../features/pdp/goldColorSwatch';
import { WishlistButton } from './WishlistButton';
import styles from './PlpProductCard.module.css';

// Shown when a product has no gold colour set.
const DEFAULT_GOLD_DOT_HEX = '#d9ad42';

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M20.5 12.5L12.5 20.5a1.5 1.5 0 0 1-2.1 0l-7-7a1.5 1.5 0 0 1 0-2.1L11.4 3.4a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v6.6a2 2 0 0 1-.5 1.5z" strokeLinejoin="round" />
      <circle cx="16" cy="7" r="1.5" />
    </svg>
  );
}

function GemIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 3h12l4 6-10 12L2 9z" strokeLinejoin="round" />
      <path d="M2 9h20M9 3l-2 6 5 12 5-12-2-6" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className={styles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="14 42" />
    </svg>
  );
}

interface PlpProductCardProps {
  product: ProductCardType;
  index?: number;
  onAddToCart: () => void;
  isAdding: boolean;
  justAdded: boolean;
  hasError: boolean;
}

export function PlpProductCard({ product, index = 0, onAddToCart, isAdding, justAdded, hasError }: PlpProductCardProps) {
  const stock = getStockStatus(product.availableStock);
  const strikePrice = product.strikePrice;

  const metalDotColor = product.goldColor ? COLOR_SWATCH[product.goldColor].hex : DEFAULT_GOLD_DOT_HEX;
  const metalLabel = product.goldColor ? COLOR_SWATCH[product.goldColor].label : 'Gold';
  const metalText = `${product.purity ?? '9K'} ${metalLabel}`;
  const stoneText = product.stoneWeightCarats ? `${product.stoneWeightCarats.toFixed(2)} ct gemstones` : null;

  return (
    <div className={styles.card}>
      <Link to={productUrl(product)} className={styles.imageLink}>
        <div
          className={styles.imageWrap}
          style={!product.primaryImageUrl ? { background: placeholderGradient(index) } : undefined}
        >
          {product.primaryImageUrl && <img src={product.primaryImageUrl} alt={productImageAlt(product)} className={styles.image} />}

          <div className={styles.badges}>
            {product.isNew && <span className={styles.badgeNew}>NEW</span>}
            {stock.state === 'low' && <span className={styles.badgeLow}>ONLY {product.availableStock} LEFT</span>}
          </div>

          <WishlistButton productId={product.id} className={styles.wishlistButton} />
        </div>
      </Link>

      <div className={styles.content}>
        {product.ratingCount > 0 && (
          <p className={styles.rating}>
            {product.ratingAvg.toFixed(1)} <span className={styles.star}>★</span>{' '}
            <span className={styles.ratingCount}>| {product.ratingCount}</span>
          </p>
        )}

        <Link to={productUrl(product)} className={styles.nameLink}>
          <h3 className={styles.name}>{product.name}</h3>
        </Link>

        <div className={styles.specRow}>
          <span className={styles.specItem}>
            <span className={styles.metalDot} style={{ background: metalDotColor }} />
            <span>{metalText}</span>
          </span>
          {stoneText && (
            <>
              <span className={styles.specDivider} />
              <span className={styles.specItem}>
                <GemIcon />
                <span>{stoneText}</span>
              </span>
            </>
          )}
        </div>

        <p className={styles.priceRow}>
          <span className={styles.price}>{formatPrice(product.sellingPrice)}</span>
          {strikePrice > 0 && <span className={styles.mrp}>{formatPrice(strikePrice)}</span>}
        </p>
        <p className={styles.taxNote}>Inclusive of all taxes</p>

        {(product.offerBadges.length > 0 || product.offerLabel) && (
          <div className={styles.offerStrip}>
            <TagIcon />
            {product.offerBadges.length > 0 ? (
              <span className={styles.offerTextGroup}>
                {product.offerBadges.map((badge) => (
                  <span key={badge.type} className={styles.offerText}>
                    {badge.label}
                  </span>
                ))}
              </span>
            ) : (
              <span className={styles.offerText}>{product.offerLabel}</span>
            )}
          </div>
        )}

        <p className={styles.stockRow}>
          <span className={styles.stockStatusGroup}>
            <span className={stock.state === 'in' ? styles.stockDotIn : styles.stockDotOther} aria-hidden="true" />
            <span className={stock.state === 'in' ? styles.stockLabelIn : styles.stockLabelOther}>{stock.label}</span>
          </span>
        </p>

        <button
          type="button"
          className={styles.addToCartButton}
          disabled={isAdding}
          aria-busy={isAdding}
          onClick={onAddToCart}
        >
          {isAdding ? <SpinnerIcon /> : justAdded ? 'Added ✓' : hasError ? 'Try again' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
