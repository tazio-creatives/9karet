import { formatPrice } from '../../utils/formatPrice';
import { placeholderGradient } from '../../utils/placeholderGradient';
import { DeliveryEstimateDetail } from '../../components/DeliveryEstimate';
import type { DeliveryEstimate } from '../../api/types';
import styles from './CheckoutOrderSummary.module.css';

export interface CheckoutSummaryItem {
  id: string;
  name: string;
  qty: number;
  image: string | null;
  price: number;
  isBackordered?: boolean;
}

interface CheckoutOrderSummaryProps {
  items: CheckoutSummaryItem[];
  itemCount: number;
  deliveryEstimate: DeliveryEstimate | null;
  subtotal: number;
  savingsAmount: number;
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
  onPlaceOrder: () => void;
  isPlacingOrder: boolean;
  // Distinct from isPlacingOrder (an in-flight request) — this covers a
  // known-incomplete checkout state (no delivery address selected yet) that
  // should keep the button inert without claiming a request is running.
  canPlaceOrder: boolean;
}

function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}

// Checkout-only order summary — deliberately not the shared OrderSummary
// component Cart uses (that one has its own already-approved look and stays
// untouched). Read-only by design: quantity/removal happens back on the
// Cart page, not mid-checkout.
export function CheckoutOrderSummary({
  items,
  itemCount,
  deliveryEstimate,
  subtotal,
  savingsAmount,
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
  onPlaceOrder,
  isPlacingOrder,
  canPlaceOrder,
}: CheckoutOrderSummaryProps) {
  return (
    <aside className={styles.card}>
      <div className={styles.totalHeader}>
        <span className={styles.totalHeaderValue}>{formatPrice(total)}</span>
        <span className={styles.totalHeaderLabel}>Total</span>
      </div>

      <div className={styles.itemsHeading}>
        <BagIcon />
        Items in the cart ({itemCount})
      </div>

      <DeliveryEstimateDetail estimate={deliveryEstimate} />

      <ul className={styles.itemList}>
        {items.map((item, i) => (
          <li key={item.id} className={styles.item}>
            <div className={styles.itemImage} style={item.image ? undefined : { background: placeholderGradient(i) }}>
              {item.image && <img src={item.image} alt="" className={styles.itemImageTag} />}
            </div>
            <div className={styles.itemDetails}>
              <p className={styles.itemName}>{item.name}</p>
              <p className={styles.itemMeta}>
                Qty {item.qty}
                {item.isBackordered && <span className={styles.backorderTag}>Make to Order</span>}
              </p>
            </div>
            <p className={styles.itemPrice}>{formatPrice(item.price * item.qty)}</p>
          </li>
        ))}
      </ul>

      <h3 className={styles.detailsHeading}>Order Details</h3>
      <div className={styles.priceRows}>
        <div className={styles.priceRow}>
          <span>Bag Total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className={styles.priceRow}>
            <span>Coupon Discount</span>
            <span className={styles.discountValue}>- {formatPrice(discountAmount)}</span>
          </div>
        )}
        <div className={styles.priceRow}>
          <span>Delivery Fee</span>
          <span className={styles.freeValue}>FREE</span>
        </div>
        <div className={styles.priceRow}>
          <span>GST ({gstPercent}%)</span>
          <span>{formatPrice(gstAmount)}</span>
        </div>
      </div>

      <div className={styles.totalRow}>
        <span>Amount Payable</span>
        <span className={styles.totalValue}>{formatPrice(total)}</span>
      </div>

      {savingsAmount > 0 && (
        <p className={styles.savingsBanner}>Your total savings on this order {formatPrice(savingsAmount)}</p>
      )}

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
            <label htmlFor="checkout-coupon-code" className={styles.visuallyHidden}>
              Coupon code
            </label>
            <input
              id="checkout-coupon-code"
              className={styles.couponInput}
              placeholder="Coupon code"
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

      {errorMessage && (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      )}

      <button type="button" className={styles.primaryAction} disabled={isPlacingOrder || !canPlaceOrder} onClick={onPlaceOrder}>
        <LockIcon />
        {isPlacingOrder ? 'Placing Order…' : 'Proceed to Payment'}
      </button>
    </aside>
  );
}
