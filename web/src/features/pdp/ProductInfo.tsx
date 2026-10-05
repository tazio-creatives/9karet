import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { GoldColor, OfferBadge, PriceBreakup, ProductDetail } from '../../api/types';
import { formatPrice } from '../../utils/formatPrice';
import { DeliveryEstimateDetail } from '../../components/DeliveryEstimate';
import { ProductAssuranceGrid } from '../../components/ProductAssuranceGrid';
import { DeliveryChecker } from './DeliveryChecker';
import { SizeSelector } from './SizeSelector';
import { ColorSelector } from './ColorSelector';
import { COLOR_SWATCH } from './goldColorSwatch';
import { PillSelector } from './PillSelector';
import { DetailsCard } from './DetailsCard';
import { PriceBreakupTable } from './PriceBreakupTable';
import { AttributesList } from './AttributesList';
import styles from './ProductInfo.module.css';

function StarRow({ ratingAvg }: { ratingAvg: number }) {
  const filled = Math.round(ratingAvg);
  return (
    <span className={styles.stars} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.8l-6.1 3.2 1.5-6.8-5.2-4.7 6.9-.7L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}

function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" strokeLinejoin="round" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M20.5 12.5L12.5 20.5a1.5 1.5 0 0 1-2.1 0l-7-7a1.5 1.5 0 0 1 0-2.1L11.4 3.4a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v6.6a2 2 0 0 1-.5 1.5z" strokeLinejoin="round" />
      <circle cx="16" cy="7" r="1.5" />
    </svg>
  );
}

function DiamondChipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 8h12l3 4-9 9-9-9 3-4z" strokeLinejoin="round" />
      <path d="M9 8l3 13 3-13M3 8h18" strokeLinejoin="round" />
    </svg>
  );
}

interface ProductInfoProps {
  product: ProductDetail;
  isOutOfStock: boolean;
  isLowStock: boolean;
  justAdded: boolean;
  isAddingToCart: boolean;
  selectedSizeId: string | null;
  onSelectSize: (sizeId: string) => void;
  selectedGoldColor: GoldColor | null;
  onSelectGoldColor: (color: GoldColor) => void;
  isColorAvailableAtPurity: (color: GoldColor, purity: string | null | undefined) => boolean;
  selectedPurity: string | null;
  onSelectPurity: (purity: string) => void;
  isPurityAvailable: (purity: string) => boolean;
  selectedDiamondConfigId: string | null;
  onSelectDiamondConfigId: (id: string) => void;
  isDiamondAvailableAtPurity: (diamondConfigId: string) => boolean;
  displayPrice: number;
  displayMrp: number;
  offerLabel: string | null;
  offerBadges: OfferBadge[];
  onAddToCart: () => void;
  onBuyNow: () => void;
  displayBreakup: PriceBreakup;
  displayGoldWeightGrams: number | null;
  displayNetWeightGrams: number | null;
  displayGrossWeightGrams: number | null;
  displayDiamondWeightCarats: number | null;
}

export function ProductInfo({
  product,
  isOutOfStock,
  isLowStock,
  justAdded,
  isAddingToCart,
  selectedSizeId,
  onSelectSize,
  selectedGoldColor,
  onSelectGoldColor,
  isColorAvailableAtPurity,
  selectedPurity,
  onSelectPurity,
  isPurityAvailable,
  selectedDiamondConfigId,
  onSelectDiamondConfigId,
  isDiamondAvailableAtPurity,
  displayPrice,
  displayMrp,
  offerLabel,
  offerBadges,
  onAddToCart,
  onBuyNow,
  displayBreakup,
  displayGoldWeightGrams,
  displayNetWeightGrams,
  displayGrossWeightGrams,
  displayDiamondWeightCarats,
}: ProductInfoProps) {
  const sizeFieldLabel = product.sizeLabel?.trim() || 'Size';
  const sizeRequired = product.sizes.length > 0 && !selectedSizeId;
  const colorRequired = product.goldColorOptions.length > 0 && !selectedGoldColor;
  const purityRequired = product.purityOptions.length > 0 && !selectedPurity;
  const diamondRequired = product.diamondOptions.length > 0 && !selectedDiamondConfigId;
  const variantRequired = sizeRequired || colorRequired || purityRequired || diamondRequired;

  // The admin's "Customer-Selectable Variations" (Gold Color / Purity /
  // Diamond Quality / Size) — shown directly, no toggle/accordion, so the
  // shopper sees every option immediately; the section is simply absent for
  // the (common) products with a single fixed configuration and none of
  // these options at all.
  const hasCustomizations =
    product.goldColorOptions.length > 0 ||
    product.purityOptions.length > 0 ||
    product.diamondOptions.length > 0 ||
    product.sizes.length > 0;

  // Buttons stay clickable rather than disabled — a missing selection is
  // surfaced as an inline message under the relevant field only once the
  // shopper actually tries to buy, not before.
  const [showValidation, setShowValidation] = useState(false);

  const colorFieldRef = useRef<HTMLDivElement>(null);
  const purityFieldRef = useRef<HTMLDivElement>(null);
  const diamondFieldRef = useRef<HTMLDivElement>(null);
  const sizeFieldRef = useRef<HTMLDivElement>(null);

  // Mobile sticky purchase bar: mirrors Add to Cart/Buy Now once the
  // original inline buttons scroll out of view, and stays visible the rest
  // of the way down the page — including over the footer — so a shopper
  // can always buy without scrolling back up. Conditionally rendering
  // (rather than just CSS-hiding) it means a screen reader never sees two
  // "Add to Cart" controls at once.
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    const actionsEl = actionsRef.current;
    if (!actionsEl) return undefined;

    const actionsObserver = new IntersectionObserver(([entry]) => {
      setShowStickyBar(!entry.isIntersecting);
    });
    actionsObserver.observe(actionsEl);

    return () => actionsObserver.disconnect();
  }, []);

  // A click that can't proceed (missing variant selection) still needs to
  // *do* something visible — otherwise it just quietly sets a flag and the
  // button looks broken. Scroll to whichever required field is first in the
  // page so the shopper actually sees why nothing happened. All fields are
  // always mounted now (no accordion to open first).
  function scrollToFirstMissingField() {
    const target = colorRequired
      ? colorFieldRef.current
      : purityRequired
        ? purityFieldRef.current
        : diamondRequired
          ? diamondFieldRef.current
          : sizeRequired
            ? sizeFieldRef.current
            : null;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleAddToCart() {
    if (variantRequired) {
      setShowValidation(true);
      scrollToFirstMissingField();
      return;
    }
    onAddToCart();
  }

  function handleBuyNow() {
    if (variantRequired) {
      setShowValidation(true);
      scrollToFirstMissingField();
      return;
    }
    onBuyNow();
  }

  const metalLabel = product.metalType === 'GOLD' ? 'Gold' : 'Platinum';

  // Quick-glance chips (no size) — reflect whatever's currently selected,
  // falling back to the product's own base attributes for axes that aren't
  // customer-selectable at all.
  const chipGoldColor = selectedGoldColor ?? product.goldColor;
  const chipPurity = selectedPurity ?? product.purity;
  const metalChipText = [chipPurity, chipGoldColor ? COLOR_SWATCH[chipGoldColor].label : metalLabel]
    .filter(Boolean)
    .join(' ');

  const selectedDiamondOption = product.diamondOptions.find((d) => d.id === selectedDiamondConfigId) ?? null;
  const diamondChipText = selectedDiamondOption?.name ?? product.diamondConfigName;

  const hasDiamonds =
    (product.diamondWeightCarats ?? 0) > 0 ||
    product.diamondOptions.length > 0 ||
    !!product.diamondConfigId ||
    !!product.diamondConfigName;
  const isGold = product.metalType === 'GOLD';

  return (
    <div className={styles.info}>
      {product.isNew && (
        <div className={styles.badges}>
          <span className={styles.badgeNew}>New</span>
        </div>
      )}
      <h1 className={styles.name}>{product.name}</h1>

      {product.ratingCount > 0 && (
        <p className={styles.rating}>
          <StarRow ratingAvg={product.ratingAvg} />
          <span className={styles.ratingValue}>{product.ratingAvg.toFixed(1)}</span>
          <span className={styles.ratingCount}>({product.ratingCount} reviews)</span>
        </p>
      )}

      <p className={styles.price}>
        {formatPrice(displayPrice)}
        {displayMrp > 0 && <span className={styles.mrp}>{formatPrice(displayMrp)}</span>}
      </p>
      <p className={styles.taxNote}>Inclusive of all taxes</p>

      {(offerBadges.length > 0 || offerLabel) && (
        <div className={styles.offerCard}>
          <span className={styles.offerLeft}>
            <span className={styles.offerIcon}>
              <TagIcon />
            </span>
            {offerBadges.length > 0 ? (
              <span className={styles.offerHeadlineGroup}>
                {offerBadges.map((badge) => (
                  <span key={badge.type} className={styles.offerHeadline}>
                    {badge.label}
                  </span>
                ))}
              </span>
            ) : (
              <span className={styles.offerHeadline}>{offerLabel}</span>
            )}
          </span>
          <span className={styles.offerNote}>Limited-period offer</span>
        </div>
      )}

      <div className={styles.stockDeliveryRow}>
        {isOutOfStock && <p className={styles.stockBackorder}>Make to Order</p>}
        {!isOutOfStock && isLowStock && (
          <p className={styles.stockLow}>Only {product.availableStock} left</p>
        )}
        {!isOutOfStock && !isLowStock && <p className={styles.stockInfo}>In Stock</p>}

        <DeliveryEstimateDetail estimate={product.deliveryEstimate} inline />
      </div>

      {product.showDeliveryChecker && <DeliveryChecker isBackordered={isOutOfStock} />}

      {/* Return and Refund Policy: an unboxing video is mandatory for any
          return — said here, before purchase, not only after delivery. */}
      <p className={styles.unboxingNote}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="m16 10.5 5-3v9l-5-3" />
        </svg>
        <span>
          Record a continuous unboxing video when your order arrives — it&rsquo;s required for any return.{' '}
          <Link to="/refund-policy#unboxing-video">Return policy</Link>
        </span>
      </p>

      {product.shortDescription && <p className={styles.description}>{product.shortDescription}</p>}

      {metalChipText && (
        <div className={styles.specChips}>
          {metalChipText && (
            <span className={styles.specChip}>
              <span
                className={styles.specChipDot}
                style={chipGoldColor ? { background: COLOR_SWATCH[chipGoldColor].hex } : undefined}
                aria-hidden="true"
              />
              {metalChipText}
            </span>
          )}
          {diamondChipText && (
            <span className={styles.specChip}>
              <DiamondChipIcon />
              {diamondChipText} Natural Diamond
            </span>
          )}
        </div>
      )}

      {hasCustomizations && (
        <div className={styles.customizeSection}>
          <span className={styles.customizeTitle}>Choose Your Options</span>

          {product.goldColorOptions.length > 0 && (
            <div className={styles.fieldGroup} ref={colorFieldRef}>
              <ColorSelector
                colors={product.goldColorOptions}
                selectedColor={selectedGoldColor}
                onSelect={onSelectGoldColor}
                selectedPurity={selectedPurity}
                isColorAvailable={isColorAvailableAtPurity}
              />
              {showValidation && colorRequired && (
                <p className={styles.fieldError}>Please select a gold color</p>
              )}
            </div>
          )}

          {product.purityOptions.length > 0 && (
            <div className={styles.fieldGroup} ref={purityFieldRef}>
              <PillSelector
                title="Gold Purity"
                options={product.purityOptions.map((p) => ({ value: p, label: p }))}
                selectedValue={selectedPurity}
                onSelect={onSelectPurity}
                isOptionAvailable={isPurityAvailable}
              />
              {showValidation && purityRequired && <p className={styles.fieldError}>Please select a purity</p>}
            </div>
          )}

          {product.diamondOptions.length > 0 && (
            <div className={styles.fieldGroup} ref={diamondFieldRef}>
              <PillSelector
                title="Natural Diamond Quality"
                options={product.diamondOptions.map((d) => ({ value: d.id, label: d.name }))}
                selectedValue={selectedDiamondConfigId}
                onSelect={onSelectDiamondConfigId}
                isOptionAvailable={isDiamondAvailableAtPurity}
              />
              {showValidation && diamondRequired && (
                <p className={styles.fieldError}>Please select a diamond quality</p>
              )}
            </div>
          )}

          {product.sizes.length > 0 && (
            <div className={styles.fieldGroup} ref={sizeFieldRef}>
              <SizeSelector
                sizes={product.sizes}
                selectedSizeId={selectedSizeId}
                onSelect={onSelectSize}
                label={sizeFieldLabel}
              />
              {showValidation && sizeRequired && (
                <p className={styles.fieldError}>Please select a {sizeFieldLabel.toLowerCase()}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className={styles.actions} ref={actionsRef}>
        <button
          type="button"
          className={styles.addToBag}
          disabled={isAddingToCart}
          onClick={handleAddToCart}
        >
          <BagIcon />
          {justAdded ? 'Added ✓' : 'Add to Cart'}
        </button>
        <button type="button" className={styles.buyNow} onClick={handleBuyNow}>
          <BoltIcon />
          Buy Now
        </button>
      </div>

      <ProductAssuranceGrid hasDiamonds={hasDiamonds} isGold={isGold} />

      <div className={styles.detailsStack}>
        <DetailsCard title="Price Breakup" className={styles.detailsCardHeading}>
          <PriceBreakupTable breakup={displayBreakup} metalType={product.metalType} diamondTypeName={product.diamondType} />
        </DetailsCard>

        <DetailsCard title="Product Details" className={styles.detailsCardHeading}>
          <AttributesList
            product={product}
            livePurity={selectedPurity}
            liveGoldColor={selectedGoldColor}
            liveDiamondConfigName={selectedDiamondOption?.name}
            liveGoldWeightGrams={displayGoldWeightGrams}
            liveNetWeightGrams={displayNetWeightGrams}
            liveGrossWeightGrams={displayGrossWeightGrams}
            liveDiamondWeightCarats={displayDiamondWeightCarats}
          />
        </DetailsCard>
      </div>

      {showStickyBar && (
        <div className={styles.mobileBar}>
          <div className={styles.mobileBarInner}>
            <div className={styles.mobileBarPrice}>
              <span className={styles.mobileBarPriceCurrent}>{formatPrice(displayPrice)}</span>
              {displayMrp > 0 && (
                <span className={styles.mobileBarPriceOld}>{formatPrice(displayMrp)}</span>
              )}
              <span className={styles.mobileBarTax}>Inclusive of all taxes</span>
            </div>
            {(offerBadges.length > 0 || offerLabel) && (
              <div className={styles.mobileBarOfferCard}>
                <span className={styles.offerLeft}>
                  <span className={styles.offerIcon}>
                    <TagIcon />
                  </span>
                  {offerBadges.length > 0 ? (
                    <span className={styles.offerHeadlineGroup}>
                      {offerBadges.map((badge) => (
                        <span key={badge.type} className={styles.offerHeadline}>
                          {badge.label}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className={styles.offerHeadline}>{offerLabel}</span>
                  )}
                </span>
                <span className={styles.offerNote}>Limited-period offer</span>
              </div>
            )}
            <div className={styles.mobileBarActions}>
              <button
                type="button"
                className={styles.mobileBarAddToBag}
                disabled={isAddingToCart}
                onClick={handleAddToCart}
              >
                <BagIcon />
                {justAdded ? 'Added ✓' : 'Add to Cart'}
              </button>
              <button type="button" className={styles.mobileBarBuyNow} onClick={handleBuyNow}>
                <BoltIcon />
                Buy Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
