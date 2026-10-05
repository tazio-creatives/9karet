import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCustomer } from '../features/auth/useCustomer';
import { SignInRequired } from '../features/auth/SignInRequired';
import { fetchCart } from '../api/cart';
import { fetchAddresses, createAddress, updateAddress, deleteAddress } from '../api/addresses';
import { submitCheckout } from '../api/checkout';
import { simulatePayment } from '../api/payments';
import { launchCashfreeCheckout } from '../features/checkout/cashfree';
import { applyCoupon } from '../api/coupons';
import { checkDeliveryPincode } from '../api/delivery';
import { PINCODE_PATTERN } from '../hooks/usePincodeCheck';
import { CheckoutAddressCard } from '../features/checkout/CheckoutAddressCard';
import { CheckoutOrderSummary } from '../features/checkout/CheckoutOrderSummary';
import { StepIndicator } from '../features/checkout/StepIndicator';
import { ProductAssuranceGrid } from '../components/ProductAssuranceGrid';
import { Breadcrumbs } from '../components/Breadcrumbs';
import type { AddressInput, BuyNowItem, CheckoutResponse } from '../api/types';
import { formatPrice } from '../utils/formatPrice';
import { effectiveMrp } from '../utils/effectiveMrp';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { ApiError } from '../api/client';
import styles from './CheckoutPage.module.css';
import placeholderStyles from './PlaceholderPage.module.css';

interface DisplayItem {
  productId: string;
  variantId: string | null;
  name: string;
  sellingPrice: number;
  mrp: number;
  sellingPriceOriginal: number;
  quantity: number;
  primaryImageUrl: string | null;
  sizeLabel: string | null;
  goldColor: string | null;
  purity: string | null;
  diamondConfigName: string | null;
  isBackordered: boolean;
}

// Backend field paths (checkout.validators.js) mapped to plain-language
// messages — the raw Zod messages ("String must contain at least...") aren't
// something a shopper should have to parse. contact.name/contact.mobile have
// no mapping here (and thus fall through to the generic checkoutError
// message) because both are always sourced from an already-validated saved
// Address, not typed directly in checkout — there's no field left for a
// name/mobile-specific message to point at.
const FIELD_ERROR_MESSAGES: Record<string, string> = {
  'contact.email': 'Please enter a valid email address.',
  addressId: 'Please select a delivery address.',
};

function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Please enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Please enter a valid email address.';
  return null;
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function CheckoutPage() {
  useDocumentTitle('Checkout');
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { customer, isLoggedIn, isLoading: isCustomerLoading } = useCustomer();

  const buyNow = (location.state as { buyNow?: BuyNowItem } | null)?.buyNow;

  const { data: cartData, isLoading: isCartLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: fetchCart,
    enabled: !buyNow && isLoggedIn,
  });

  const { data: addressesData, isLoading: isAddressesLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: fetchAddresses,
    enabled: isLoggedIn,
  });

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState(customer?.email ?? '');
  const [deliveryNote, setDeliveryNote] = useState('');

  const addresses = addressesData?.addresses ?? [];

  // Delivery check for the selected address — the backend refuses checkout
  // for a pincode the courier can't serve, so say so up front and keep
  // "Proceed to Payment" disabled rather than letting the customer hit that
  // error. Unknown (courier unreachable) doesn't block.
  const selectedPincode = addresses.find((a) => a.id === selectedAddressId)?.pincode ?? null;
  const { data: pincodeCheck } = useQuery({
    queryKey: ['delivery-pincode', selectedPincode],
    queryFn: () => checkDeliveryPincode(selectedPincode as string),
    enabled: !!selectedPincode && PINCODE_PATTERN.test(selectedPincode),
    staleTime: 10 * 60 * 1000,
  });
  const undeliverableMessage =
    selectedPincode && !PINCODE_PATTERN.test(selectedPincode)
      ? `This address has an invalid pincode (${selectedPincode}). Please edit the address and enter a valid 6-digit pincode.`
      : pincodeCheck && pincodeCheck.pincode === selectedPincode && pincodeCheck.serviceable === false
        ? `Sorry, we don't deliver to pincode ${selectedPincode} yet. Please choose a different delivery address.`
        : null;

  // Seed the selection from the customer's default (or most recent) saved
  // address the first time addresses load — a one-time seed tracked by this
  // ref rather than by `selectedAddressId` being null, since deleting the
  // selected address also (deliberately) sets it back to a fallback and
  // shouldn't be mistaken for "never seeded."
  const hasSeededAddressRef = useRef(false);
  useEffect(() => {
    if (addresses.length === 0 || hasSeededAddressRef.current) return;
    hasSeededAddressRef.current = true;
    const initial = addresses.find((a) => a.isDefault) ?? addresses[0];
    setSelectedAddressId(initial.id);
    // addressesData (not the `addresses` fallback-to-[] derivation, which is
    // a fresh array every render) — react-query only gives a new reference
    // on real data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressesData]);

  useEffect(() => {
    if (!customer) return;
    setContactEmail((prev) => prev || customer.email || '');
  }, [customer]);

  const [orderResult, setOrderResult] = useState<CheckoutResponse | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  // An error from a previous "Proceed to Payment" (e.g. the server refusing
  // the old address) mustn't stick around once a different address is picked.
  useEffect(() => {
    setCheckoutError(null);
    setStatusMessage('');
  }, [selectedAddressId]);

  // Mobile sticky payment bar must never sit on top of the footer — hide it
  // once the footer scrolls into view (same pattern as CartPage).
  const [hideStickyBarForFooter, setHideStickyBarForFooter] = useState(false);
  useEffect(() => {
    const footerEl = document.querySelector('footer');
    if (!footerEl) return undefined;
    const observer = new IntersectionObserver(([entry]) => setHideStickyBarForFooter(entry.isIntersecting));
    observer.observe(footerEl);
    return () => observer.disconnect();
  }, []);

  const createAddressMutation = useMutation({
    mutationFn: (input: AddressInput) => createAddress(input),
    onSuccess: ({ address }) => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setSelectedAddressId(address.id);
      setCheckoutError(null);
      setStatusMessage('New delivery address added.');
    },
  });

  const updateAddressMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AddressInput> }) => updateAddress(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setStatusMessage('Delivery address updated.');
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: (id: string) => deleteAddress(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      // The deleted address was the selected one — fall back to another
      // saved address (its default, if any) rather than leaving checkout
      // with no delivery address selected when perfectly good ones remain.
      if (selectedAddressId === id) {
        const remaining = addresses.filter((a) => a.id !== id);
        const fallback = remaining.find((a) => a.isDefault) ?? remaining[0] ?? null;
        setSelectedAddressId(fallback ? fallback.id : null);
      }
      setStatusMessage('Delivery address removed.');
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: submitCheckout,
    onSuccess: async (result) => {
      setOrderResult(result);
      const { providerRef, paymentSessionId } = result.payment;
      if (paymentSessionId) {
        // Real gateway (Cashfree) — launch its Drop-in checkout. Whatever
        // happens (paid, failed, or the customer just closes the modal),
        // move on to the confirmation page — it polls the backend for the
        // real, webhook-confirmed status rather than trusting anything the
        // SDK itself reports (see paymentService.confirmPayment).
        try {
          await launchCashfreeCheckout(paymentSessionId);
        } catch (err) {
          console.error('Cashfree checkout failed to launch:', err);
        }
        navigate(`/order-confirmation/${result.order.id}`);
      } else {
        // Stub (dev only) — no real gateway, auto-completes.
        payMutation.mutate({ providerRef, outcome: 'SUCCEEDED' });
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields && err.fields.length > 0) {
        setCheckoutError(null);
        setEmailError(null);
        for (const field of err.fields) {
          const message = FIELD_ERROR_MESSAGES[field.path] ?? err.message;
          if (field.path === 'contact.email') setEmailError(message);
          else setCheckoutError(message);
        }
        setStatusMessage('Please fix the highlighted checkout details.');
        return;
      }
      const message = err instanceof ApiError ? err.message : 'Could not place order.';
      setCheckoutError(message);
      setStatusMessage(message);
    },
  });

  const applyCouponMutation = useMutation({
    mutationFn: (subtotal: number) => applyCoupon(couponInput, subtotal),
    onSuccess: (result) => {
      setAppliedCoupon({ code: result.coupon.code, discountAmount: result.discountAmount });
      setCouponError(null);
      setStatusMessage(`Coupon ${result.coupon.code} applied.`);
    },
    onError: (err) => {
      setAppliedCoupon(null);
      const message = err instanceof ApiError ? err.message : 'Could not apply coupon.';
      setCouponError(message);
      setStatusMessage(`Coupon error: ${message}`);
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ providerRef, outcome }: { providerRef: string; outcome: 'SUCCEEDED' | 'FAILED' }) =>
      simulatePayment(providerRef, outcome),
    onSuccess: (result) => {
      // Cart invalidation now lives on OrderConfirmationPage (fires once
      // the order's polled status actually shows CONFIRMED) — that same
      // logic has to exist there anyway for the real Cashfree flow, which
      // has no synchronous "payment succeeded" response to hook into.
      navigate(`/order-confirmation/${result.order.id}`);
    },
    onError: (err) => {
      setPaymentError(err instanceof ApiError ? err.message : 'Payment could not be processed.');
    },
  });

  const statusRegion = (
    <p role="status" aria-live="polite" className={styles.visuallyHidden}>
      {statusMessage}
    </p>
  );

  const headingRow = (
    <div className={styles.headingRow}>
      <Link to="/cart" className={styles.backChevron} aria-label="Back to Bag">
        <ChevronLeftIcon />
      </Link>
      <h1 className={styles.heading}>Checkout</h1>
    </div>
  );

  if (!isCustomerLoading && !isLoggedIn) {
    return (
      <div className={styles.page}>
        {statusRegion}
        <Breadcrumbs items={[{ label: 'Cart', href: '/cart' }, { label: 'Checkout' }]} />
        <SignInRequired message="Sign in to continue to checkout." />
      </div>
    );
  }

  if (isCustomerLoading || isAddressesLoading || (!buyNow && isCartLoading)) {
    return (
      <div className={styles.page} aria-busy="true">
        {statusRegion}
        <Breadcrumbs items={[{ label: 'Cart', href: '/cart' }, { label: 'Checkout' }]} />
        {headingRow}
        <StepIndicator currentStep={2} />
        <div className={styles.layout}>
          <div className={styles.mainColumnTop}>
            <div className={styles.skeletonAddressCard} />
          </div>
          <div className={styles.summaryColumn}>
            <div className={styles.skeletonSummary} />
          </div>
        </div>
      </div>
    );
  }

  const displayItems: DisplayItem[] = buyNow
    ? [
        {
          productId: buyNow.productId,
          variantId: buyNow.variantId ?? null,
          name: buyNow.name,
          sellingPrice: buyNow.sellingPrice,
          mrp: buyNow.sellingPrice,
          sellingPriceOriginal: buyNow.sellingPrice,
          quantity: buyNow.quantity,
          primaryImageUrl: buyNow.primaryImageUrl,
          sizeLabel: buyNow.sizeLabel ?? null,
          goldColor: buyNow.goldColor ?? null,
          purity: buyNow.purity ?? null,
          diamondConfigName: buyNow.diamondConfigName ?? null,
          isBackordered: buyNow.isBackordered ?? false,
        },
      ]
    : (cartData?.items ?? []).map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        name: i.name,
        sellingPrice: i.sellingPrice,
        mrp: i.mrp,
        sellingPriceOriginal: i.sellingPriceOriginal,
        quantity: i.quantity,
        primaryImageUrl: i.primaryImageUrl,
        sizeLabel: i.sizeLabel,
        goldColor: i.goldColor,
        purity: i.purity,
        diamondConfigName: i.diamondConfigName,
        isBackordered: i.isBackordered,
      }));

  // GST-inclusive, same convention as Cart.subtotal.
  const subtotalInclGst = displayItems.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);
  const gstAmount = buyNow ? buyNow.gstAmount : (cartData?.gstAmount ?? 0);
  const preTaxSubtotal = Math.max(subtotalInclGst - gstAmount, 0);
  const gstPercent = preTaxSubtotal > 0 ? Math.round((gstAmount / preTaxSubtotal) * 100) : 0;
  const discountAmount = appliedCoupon?.discountAmount ?? 0;
  const total = Math.max(subtotalInclGst - discountAmount, 0);

  // Sum of every line's (strike-through MRP - selling price) — mirrors
  // CartPage's identical calculation. Buy Now items carry no mrp/
  // sellingPriceOriginal of their own (see DisplayItem mapping above, which
  // seeds both from sellingPrice), so effectiveMrp naturally yields 0 there
  // and the savings banner just doesn't show for that flow.
  const savingsAmount = displayItems.reduce((sum, item) => {
    const { strikePrice } = effectiveMrp(item.sellingPrice, item.mrp, item.sellingPriceOriginal);
    return sum + Math.max(strikePrice - item.sellingPrice, 0) * item.quantity;
  }, 0);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;

  // Buy Now carries the estimate the shopper already saw on the PDP (see
  // PDPPage's onBuyNow); the cart flow reads the live one from the cart
  // fetch above — either way, this is the backend-computed value, never
  // something derived here.
  const deliveryEstimate = buyNow ? (buyNow.deliveryEstimate ?? null) : (cartData?.deliveryEstimate ?? null);

  const summaryItems = displayItems.map((item) => {
    const variantBits = [item.sizeLabel ? `Size ${item.sizeLabel}` : null, item.diamondConfigName].filter(Boolean);
    return {
      id: item.variantId ?? item.productId,
      name: variantBits.length > 0 ? `${item.name} (${variantBits.join(', ')})` : item.name,
      qty: item.quantity,
      image: item.primaryImageUrl,
      price: item.sellingPrice,
      isBackordered: item.isBackordered,
    };
  });

  // Order is created — placing it redirects straight into the payment
  // gateway step (stub, plan §11), which confirms automatically and then
  // forwards to order confirmation, or shows a retry if that call fails.
  if (orderResult) {
    const { order } = orderResult;
    return (
      <div className={styles.page}>
        <Breadcrumbs items={[{ label: 'Cart', href: '/cart' }, { label: 'Checkout' }]} />
        <div className={styles.heroPlain}>
          <StepIndicator currentStep={3} />
          <div className={styles.paymentBox}>
            {paymentError ? (
              <>
                <p className={styles.paymentTotal}>{formatPrice(order.totalAmount)}</p>
                <p className={styles.paymentOrderNumber}>Order {order.orderNumber}</p>
                <p className={styles.error}>{paymentError}</p>
                <button
                  type="button"
                  className={styles.payButton}
                  disabled={payMutation.isPending}
                  onClick={() => {
                    setPaymentError(null);
                    payMutation.mutate({ providerRef: orderResult.payment.providerRef, outcome: 'SUCCEEDED' });
                  }}
                >
                  {payMutation.isPending ? 'Retrying…' : 'Try again'}
                </button>
              </>
            ) : (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                <p className={styles.paymentGatewayTitle}>Redirecting to secure payment gateway…</p>
                <p className={styles.paymentTotal}>{formatPrice(order.totalAmount)}</p>
                <p className={styles.paymentOrderNumber}>Order {order.orderNumber}</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  async function handlePlaceOrder() {
    setCheckoutError(null);
    setEmailError(null);

    if (!selectedAddress) {
      setCheckoutError('Please select a delivery address.');
      setStatusMessage('Please select a delivery address.');
      return;
    }
    const emailValidationError = validateEmail(contactEmail);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      setStatusMessage(emailValidationError);
      return;
    }
    if (displayItems.length === 0) {
      setCheckoutError('There is nothing to check out.');
      return;
    }

    checkoutMutation.mutate({
      contact: { name: selectedAddress.name, mobile: selectedAddress.mobileNumber, email: contactEmail.trim() },
      addressId: selectedAddress.id,
      items: displayItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        ...(i.variantId ? { variantId: i.variantId } : {}),
      })),
      ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
      ...(deliveryNote.trim() ? { deliveryNote: deliveryNote.trim() } : {}),
    });
  }

  if (displayItems.length === 0) {
    return (
      <div className={placeholderStyles.container}>
        <p className={placeholderStyles.body}>Your bag is empty.</p>
        <Link to="/" className={styles.continueLink}>
          Continue shopping
        </Link>
      </div>
    );
  }

  const isPlacingOrder =
    checkoutMutation.isPending || payMutation.isPending || createAddressMutation.isPending || updateAddressMutation.isPending;
  const canPlaceOrder = selectedAddressId !== null && !undeliverableMessage;

  return (
    <div className={styles.page}>
      {statusRegion}
      <Breadcrumbs items={[{ label: 'Cart', href: '/cart' }, { label: 'Checkout' }]} />

      {headingRow}
      <StepIndicator currentStep={2} />

      <div className={styles.layout}>
        <div className={styles.mainColumnTop}>
          <CheckoutAddressCard
            addresses={addresses}
            selectedAddressId={selectedAddressId}
            onSelectAddress={setSelectedAddressId}
            onCreateAddress={(input) => createAddressMutation.mutateAsync(input)}
            onUpdateAddress={(id, input) => updateAddressMutation.mutateAsync({ id, input })}
            onDeleteAddress={(id) => deleteAddressMutation.mutateAsync(id)}
            onSetDefault={(id) => updateAddressMutation.mutate({ id, input: { isDefault: true } })}
            isDeletingAddress={deleteAddressMutation.isPending}
            addressError={checkoutError ?? undeliverableMessage}
            contactEmail={contactEmail}
            onContactEmailChange={setContactEmail}
            emailError={emailError}
            deliveryNote={deliveryNote}
            onDeliveryNoteChange={setDeliveryNote}
          />
        </div>

        <div className={styles.summaryColumn}>
          <CheckoutOrderSummary
            items={summaryItems}
            itemCount={displayItems.reduce((sum, i) => sum + i.quantity, 0)}
            deliveryEstimate={deliveryEstimate}
            subtotal={preTaxSubtotal}
            savingsAmount={savingsAmount}
            discountAmount={discountAmount}
            gstAmount={gstAmount}
            gstPercent={gstPercent}
            total={total}
            couponInput={couponInput}
            onCouponInputChange={setCouponInput}
            appliedCoupon={appliedCoupon}
            couponError={couponError}
            isApplyingCoupon={applyCouponMutation.isPending}
            onApplyCoupon={() => applyCouponMutation.mutate(subtotalInclGst)}
            onRemoveCoupon={() => {
              setAppliedCoupon(null);
              setCouponInput('');
              setCouponError(null);
              setStatusMessage('Coupon removed.');
            }}
            errorMessage={checkoutError ?? undeliverableMessage}
            onPlaceOrder={handlePlaceOrder}
            isPlacingOrder={isPlacingOrder}
            canPlaceOrder={canPlaceOrder}
          />
        </div>

        <div className={styles.mainColumnBottom}>
          {/* Same visual as the Cart/PDP trust banner — checkout isn't tied
              to one product's real metal/diamond composition either, so
              both flags are on to show the full, generic assurance set. */}
          <ProductAssuranceGrid hasDiamonds isGold />
          <div className={styles.backToBagRow}>
            <Link to="/cart" className={styles.backToBagLink}>
              ← Back to Bag
            </Link>
          </div>
        </div>
      </div>

      <div className={`${styles.stickyBar} ${hideStickyBarForFooter ? styles.stickyBarHidden : ''}`}>
        <div className={styles.stickyBarTotal}>
          <p className={styles.stickyBarLabel}>Total</p>
          <p className={styles.stickyBarValue}>{formatPrice(total)}</p>
        </div>
        <button
          type="button"
          className={styles.stickyBarButton}
          disabled={isPlacingOrder || !canPlaceOrder}
          onClick={handlePlaceOrder}
        >
          {isPlacingOrder ? 'Placing…' : 'Proceed to Payment'}
        </button>
      </div>
    </div>
  );
}
