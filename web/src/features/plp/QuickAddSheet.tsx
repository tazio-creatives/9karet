import { useEffect } from 'react';
import { trackAddToCart } from '../../analytics/ecommerce';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { Cart, ProductDetail } from '../../api/types';
import { addCartItem } from '../../api/cart';
import { useVariantSelection } from '../../hooks/useVariantSelection';
import { formatPrice } from '../../utils/formatPrice';
import { getStockStatus } from '../../utils/stockStatus';
import { ColorSelector } from '../pdp/ColorSelector';
import { PillSelector } from '../pdp/PillSelector';
import { SizeSelector } from '../pdp/SizeSelector';
import styles from './QuickAddSheet.module.css';

interface QuickAddSheetProps {
  product: ProductDetail;
  onClose: () => void;
  // Optional — the Wishlist page uses it to remove the item once it's
  // actually in the cart ("Move to Bag" semantics); see useQuickAdd's onAdded.
  onAdded?: (_productId: string) => void;
}

// Compact mobile bottom sheet shown when a PLP "Add to Cart" tap lands on a
// product with mandatory selections — reuses the exact same selector
// components and variant-selection/pricing hook as the PDP, so validation,
// defaults, and price recompute all stay identical rather than reimplemented.
export function QuickAddSheet({ product, onClose, onAdded }: QuickAddSheetProps) {
  const queryClient = useQueryClient();
  const {
    selectedSizeId,
    setSelectedSizeId,
    selectedGoldColor,
    setSelectedGoldColor,
    selectedPurity,
    setSelectedPurity,
    selectedDiamondConfigId,
    setSelectedDiamondConfigId,
    selectedVariantId,
    isColorAvailableAtPurity,
    isPurityAvailable,
    isDiamondAvailableAtPurity,
    isOutOfStock,
    displayPrice,
    displayMrp,
  } = useVariantSelection(product);

  const sizeRequired = product.sizes.length > 0 && !selectedSizeId;
  const colorRequired = product.goldColorOptions.length > 0 && !selectedGoldColor;
  const purityRequired = product.purityOptions.length > 0 && !selectedPurity;
  const diamondRequired = product.diamondOptions.length > 0 && !selectedDiamondConfigId;
  const variantRequired = sizeRequired || colorRequired || purityRequired || diamondRequired || !selectedVariantId;

  const addMutation = useMutation({
    mutationFn: () => addCartItem(product.id, 1, selectedVariantId),
    onSuccess: (cart: Cart) => {
      const prevCart = queryClient.getQueryData<Cart>(['cart']);
      queryClient.setQueryData(['cart'], cart);
      trackAddToCart({ prevCart, nextCart: cart, productId: product.id, variantId: selectedVariantId, quantity: 1 });
      onAdded?.(product.id);
      onClose();
    },
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const stock = getStockStatus(product.availableStock);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <p className={styles.name}>{product.name}</p>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.selectors}>
          {product.goldColorOptions.length > 0 && (
            <ColorSelector
              colors={product.goldColorOptions}
              selectedColor={selectedGoldColor}
              onSelect={setSelectedGoldColor}
              selectedPurity={selectedPurity}
              isColorAvailable={isColorAvailableAtPurity}
            />
          )}
          {product.purityOptions.length > 0 && (
            <PillSelector
              title="Gold Purity"
              options={product.purityOptions.map((p) => ({ value: p, label: p }))}
              selectedValue={selectedPurity}
              onSelect={setSelectedPurity}
              isOptionAvailable={isPurityAvailable}
            />
          )}
          {product.diamondOptions.length > 0 && (
            <PillSelector
              title="Natural Diamond Quality"
              options={product.diamondOptions.map((d) => ({ value: d.id, label: d.name }))}
              selectedValue={selectedDiamondConfigId}
              onSelect={setSelectedDiamondConfigId}
              isOptionAvailable={isDiamondAvailableAtPurity}
            />
          )}
          {product.sizes.length > 0 && (
            <SizeSelector
              sizes={product.sizes}
              selectedSizeId={selectedSizeId}
              onSelect={setSelectedSizeId}
              label={product.sizeLabel?.trim() || 'Size'}
            />
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.priceRow}>
            <span className={styles.price}>{formatPrice(displayPrice)}</span>
            {displayMrp > 0 && <span className={styles.mrp}>{formatPrice(displayMrp)}</span>}
          </div>
          <p className={isOutOfStock ? styles.stockOut : styles.stockOk}>
            {stock.label} · {stock.deliveryText}
          </p>
          {variantRequired && (
            <p className={styles.hint}>Select all options to continue</p>
          )}
          <button
            type="button"
            className={styles.confirmButton}
            disabled={variantRequired || addMutation.isPending}
            aria-busy={addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            {addMutation.isPending ? 'Adding…' : 'Confirm Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
