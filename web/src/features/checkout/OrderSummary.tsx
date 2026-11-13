import { useState, type ReactNode } from 'react';
import { formatPrice } from '../../utils/formatPrice';
import { placeholderGradient } from '../../utils/placeholderGradient';
import { DeliveryEstimateDetail } from '../../components/DeliveryEstimate';
import type { DeliveryEstimate } from '../../api/types';
import styles from './OrderSummary.module.css';

export interface OrderSummaryItem {
  id: string;
  name: string;
  qty: number;
  image: string | null;
  price: number;
  isBackordered?: boolean;
}

export interface OrderSummaryAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface OrderSummaryProps {
  items?: OrderSummaryItem[];
  itemCount: number;
  deliveryEstimate?: DeliveryEstimate | null;
  subtotal: number;
  // Sum of (strike-through MRP - selling price) across every line item —
  // a coupon discount, separately. Omitted/0 hides the row entirely, so
  // Checkout (which never computes this) renders exactly as before.
  savingsAmount?: number;
  discountAmount: number;
  gstAmount: number;
  gstPercent: number;
  total: number;
  couponInput: string;
  onCouponInputChange: (_value: string) => void;
  appliedCoupon: { code: string } | null;
  couponError: string | null;
  isApplyingCoupon: boolean;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  errorMessage?: string | null;
  primaryAction?: OrderSummaryAction;
  secondaryAction?: OrderSummaryAction;
  showTrustList?: boolean;
  // Cart page has its own fixed mobile checkout bar — showing primaryAction
  // there too would duplicate the "Proceed to Checkout" button. Checkout
  // page never passes primaryAction at all, so this only ever matters here.
  hidePrimaryOnMobile?: boolean;
  // Lets one caller (CartPage) restyle just these two pieces without
  // touching Checkout's — same reasoning as RelatedProducts' own
  // `className` prop (PDP vs Cart's "Best Sellers" spacing).
  headingClassName?: string;
  secondaryActionClassName?: string;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 7h11v10H2z" />
      <path d="M13 10h4l4 3v4h-8z" />
      <circle cx="6" cy="19" r="1.7" />
      <circle cx="17" cy="19" r="1.7" />
    </svg>
  );
}

function CertifiedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2l2.4 1.4 2.8-.2 1 2.6 2.4 1.4-.6 2.8.6 2.8-2.4 1.4-1 2.6-2.8-.2L12 18l-2.4 1.4-2.8.2-1-2.6-2.4-1.4.6-2.8-.6-2.8 2.4-1.4 1-2.6 2.8.2L12 2z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

const TRUST_ITEMS = [
  { Icon: CertifiedIcon, title: 'Purity Guaranteed', subtitle: 'on every online purchase' },
  { Icon: TruckIcon, title: 'Secure Delivery', subtitle: 'by our trusted partners' },
  { Icon: ShieldIcon, title: 'Easy & Secure Payments', subtitle: '100% safe & encrypted' },
];

export function OrderSummary({
  items,
  itemCount,
  deliveryEstimate = null,
  subtotal,
  savingsAmount = 0,
  discountAmount,
  gstAmount,
  gstPercent,
  total,
  couponInput,
  onCouponInputChange,
  appliedCoupon,
  couponError,
  isApplyingCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  errorMessage,
  primaryAction,
  secondaryAction,
  showTrustList = true,
  hidePrimaryOnMobile = false,
  headingClassName,
  secondaryActionClassName,
}: OrderSummaryProps) {
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const PREVIEW_COUNT = 2;
  const hasMoreThanPreview = (items?.length ?? 0) > PREVIEW_COUNT;
  const hiddenCount = items ? Math.max(items.length - PREVIEW_COUNT, 0) : 0;

  return (
    <aside className={styles.card}>
      <div className={styles.headingRow}>
        <h2 className={headingClassName ? `${styles.heading} ${headingClassName}` : styles.heading}>
          Order Summary
          {items && items.length > 0 && (
            <span className={styles.headingCount}>
              {' '}
              ({items.length} {items.length === 1 ? 'item' : 'items'})
            </span>
          )}
        </h2>
        {hasMoreThanPreview && (
          <button
            type="button"
            className={styles.expandToggle}
            aria-expanded={itemsExpanded}
            aria-label={itemsExpanded ? 'Collapse order items' : 'Expand order items'}
            onClick={() => setItemsExpanded((v) => !v)}
          >
            <ChevronIcon expanded={itemsExpanded} />
          </button>
        )}
      </div>

      <DeliveryEstimateDetail estimate={deliveryEstimate} />

      {items && items.length > 0 && !itemsExpanded && (
        <div className={styles.itemsPreview}>
          <div className={styles.previewThumbs}>
            {items.slice(0, PREVIEW_COUNT).map((item, i) => (
              <div
                key={item.id}
                className={styles.previewThumb}
                style={item.image ? undefined : { background: placeholderGradient(i) }}
              >
                {item.image && <img src={item.image} alt="" className={styles.previewThumbImg} />}
              </div>
            ))}
            {hiddenCount > 0 && <div className={styles.previewThumbMore}>+{hiddenCount}</div>}
          </div>
          <ul className={styles.previewNames}>
            {items.slice(0, PREVIEW_COUNT).map((item) => (
              <li key={item.id} className={styles.previewNameRow}>
                <span className={styles.previewName}>{item.name}</span>
                <span className={styles.previewQtyPrice}>
                  Qty {item.qty} · {formatPrice(item.price * item.qty)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {items && items.length > 0 && itemsExpanded && (
        <ul className={styles.itemList}>
          {items.map((item, i) => (
            <li key={item.id} className={styles.item}>
              <div
                className={styles.itemImage}
                style={item.image ? undefined : { background: placeholderGradient(i) }}
              >
                {item.image && <img src={item.image} alt={item.name} className={styles.itemImageTag} />}
              </div>
              <div className={styles.itemDetails}>
                <p className={styles.itemName}>
                  {item.name}
                  {item.isBackordered && <span className={styles.backorderTag}>Make to Order</span>}
                </p>
                <p className={styles.itemQty}>Qty: {item.qty}</p>
              </div>
              <p className={styles.itemPrice}>{formatPrice(item.price * item.qty)}</p>
            </li>
          ))}
        </ul>
      )}

      {hasMoreThanPreview && (
        <button type="button" className={styles.viewAllLink} onClick={() => setItemsExpanded((v) => !v)}>
          {itemsExpanded ? 'Show less' : `View all ${items!.length} items`}
        </button>
      )}

      <div className={styles.priceRows}>
        <div className={styles.priceRow}>
          <span>
            Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        {savingsAmount > 0 && (
          <div className={styles.priceRow}>
            <span>You Saved</span>
            <span className={styles.savingsValue}>{formatPrice(savingsAmount)}</span>
          </div>
        )}
        {discountAmount > 0 && (
          <div className={styles.priceRow}>
            <span>Discount</span>
            <span className={styles.discountValue}>- {formatPrice(discountAmount)}</span>
          </div>
        )}
        <div className={styles.priceRow}>
          <span>Shipping</span>
          <span className={styles.freeValue}>FREE</span>
        </div>
        <div className={styles.priceRow}>
          <span>GST ({gstPercent}%)</span>
          <span>{formatPrice(gstAmount)}</span>
        </div>
      </div>

      <div className={styles.totalRow}>
        <span>Total</span>
        <span className={styles.totalValue}>{formatPrice(total)}</span>
      </div>

      <div className={styles.couponRow}>
        {appliedCoupon ? (
          <div className={styles.couponApplied}>
            <span>
              Coupon <strong>{appliedCoupon.code}</strong> applied
            </span>
            <button type="button" className={styles.couponRemove} onClick={onRemoveCoupon}>
              Remove
            </button>
          </div>
        ) : (
          <div className={styles.couponInputRow}>
            <label htmlFor="cart-coupon-code" className={styles.visuallyHidden}>
              Coupon code
            </label>
            <input
              id="cart-coupon-code"
              className={styles.couponInput}
              placeholder="Enter Coupon Code"
              value={couponInput}
              aria-invalid={couponError ? true : undefined}
              onChange={(e) => onCouponInputChange(e.target.value)}
            />
            <button
              type="button"
              className={styles.couponApplyButton}
              disabled={!couponInput.trim() || isApplyingCoupon}
              onClick={onApplyCoupon}
            >
              {isApplyingCoupon ? 'Applying…' : 'Apply'}
            </button>
          </div>
        )}
        {couponError && <p className={styles.error}>{couponError}</p>}
      </div>

      <p className={styles.insuredNote}>
        <ShieldIcon />
        Your order is insured and delivered safely.
      </p>

      {errorMessage && <p className={styles.error}>{errorMessage}</p>}

      {primaryAction && (
        <button
          type="button"
          className={`${styles.primaryAction} ${hidePrimaryOnMobile ? styles.primaryActionHideMobile : ''}`}
          disabled={primaryAction.disabled}
          onClick={primaryAction.onClick}
        >
          {primaryAction.icon}
          {primaryAction.label}
        </button>
      )}

      {secondaryAction && (
        <button
          type="button"
          className={
            secondaryActionClassName ? `${styles.secondaryAction} ${secondaryActionClassName}` : styles.secondaryAction
          }
          disabled={secondaryAction.disabled}
          onClick={secondaryAction.onClick}
        >
          {secondaryAction.icon}
          {secondaryAction.label}
        </button>
      )}

      {showTrustList && (
        <ul className={styles.trustList}>
          {TRUST_ITEMS.map(({ Icon, title, subtitle }) => (
            <li key={title} className={styles.trustItem}>
              <span className={styles.trustIcon}>
                <Icon />
              </span>
              <div>
                <p className={styles.trustTitle}>{title}</p>
                <p className={styles.trustSubtitle}>{subtitle}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
