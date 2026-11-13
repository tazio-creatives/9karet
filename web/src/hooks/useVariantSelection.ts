import { useEffect, useState } from 'react';
import type { ProductDetail, GoldColor, VariantPricePreview } from '../api/types';
import { fetchVariantPricePreview } from '../api/products';

const LOW_STOCK_THRESHOLD = 3;

// 1 ct = 0.2 g — a piece's stones add into its gross weight.
const GRAMS_PER_CARAT = 0.2;

function findAttributeValueId(
  product: ProductDetail,
  code: string,
  matches: (v: { value: string; refId: string | null }) => boolean,
): string | null {
  return product.attributes.find((a) => a.code === code)?.values.find(matches)?.id ?? null;
}

// Every 9Karet product carries exactly one purity value (9K) — it's part of
// each variant's combination, but never something the shopper picks.
function productPurity(product: ProductDetail): string | null {
  return product.attributes.find((a) => a.code === 'purity')?.values[0]?.value ?? null;
}

// Resolves a {goldColor, purity, sizeId} selection to a real
// product_variants row — every axis the product actually has configured
// must be selected for a match to exist (variants are exact combinations).
// Returns null while the selection is still incomplete or doesn't
// correspond to any real (offered) combination.
function resolveVariantId(
  product: ProductDetail,
  selection: { goldColor: GoldColor | null; purity: string | null; sizeId: string | null },
): string | null {
  const requiredIds: string[] = [];
  if (selection.goldColor) {
    const id = findAttributeValueId(product, 'gold_color', (v) => v.value === selection.goldColor);
    if (!id) return null;
    requiredIds.push(id);
  }
  if (selection.purity) {
    const id = findAttributeValueId(product, 'purity', (v) => v.value === selection.purity);
    if (!id) return null;
    requiredIds.push(id);
  }
  // sizeId is already an attribute_value id (see products.controller.js's
  // `sizes` derived field — its `id` is the size attribute_value's own id).
  if (selection.sizeId) requiredIds.push(selection.sizeId);

  const sortedRequired = [...requiredIds].sort();
  const match = product.variants.find((v) => {
    if (!v.isAvailable) return false;
    const sortedActual = [...v.attributeValueIds].sort();
    return sortedActual.length === sortedRequired.length && sortedActual.every((id, i) => id === sortedRequired[i]);
  });
  return match?.id ?? null;
}

// True if some currently-*available* variant carries every one of the given
// attribute_value ids together. Checking v.isAvailable here is what actually
// makes an admin's Availability Rule (or a manual per-variant exclusion)
// take effect on the storefront: a combination can have a real variant row
// and still not be offered.
function isCombinationAvailable(product: ProductDetail, ids: string[]): boolean {
  if (ids.length === 0) return true;
  return product.variants.some((v) => v.isAvailable && ids.every((id) => v.attributeValueIds.includes(id)));
}

// A colour is available if at least one real, currently-offered variant
// carries it — e.g. an Availability Rule can switch Rose Gold off entirely.
function colorAvailable(product: ProductDetail, color: GoldColor): boolean {
  const colorId = findAttributeValueId(product, 'gold_color', (v) => v.value === color);
  if (!colorId) return true; // axis not configured at all — nothing to conflict with
  return isCombinationAvailable(product, [colorId]);
}

// Owns gold color / size selection, live price-preview recompute, and
// admin-default selection for any surface that needs to add a variant
// product to cart — shared by the PDP and the PLP quick-add sheet so both
// default and validate identically.
export function useVariantSelection(product: ProductDetail | undefined) {
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [selectedGoldColor, setSelectedGoldColor] = useState<GoldColor | null>(null);
  const [pricePreview, setPricePreview] = useState<VariantPricePreview | null>(null);

  // A different product's variant choices never carry over — reset them
  // whenever the caller switches to a new product.
  useEffect(() => {
    setSelectedSizeId(null);
    setSelectedGoldColor(null);
    setPricePreview(null);
  }, [product]);

  const selectedPurity = product ? productPurity(product) : null;
  const selectedVariantId = product
    ? resolveVariantId(product, { goldColor: selectedGoldColor, purity: selectedPurity, sizeId: selectedSizeId })
    : null;

  // Only a fully-resolved, real combination can be priced — live-recomputed
  // from the same engine cart/checkout use, so what's shown here (and what
  // gets added to cart) always matches what actually gets charged. While
  // the selection is still incomplete, displayPrice below falls back to the
  // product's own base price.
  useEffect(() => {
    setPricePreview(null);
    if (!product || !selectedVariantId) return;
    let cancelled = false;
    fetchVariantPricePreview(product.id, { variantId: selectedVariantId })
      .then((result) => {
        if (!cancelled) setPricePreview(result);
      })
      .catch(() => {
        if (!cancelled) setPricePreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [product, selectedVariantId]);

  // Gold Color defaults to whichever value the admin set as the product's
  // own base configuration (falling back to Yellow, then the first offered
  // colour). Size has no equivalent "admin default", so it defaults to the
  // smallest size — the same one the backend's cached base price is computed
  // for (productsService.js's pickSmallestSizeValue). Keyed on the product
  // id so this only runs once per product load and never clobbers a
  // shopper's own later choice.
  useEffect(() => {
    if (!product) return;
    if (product.goldColorOptions.length > 0) {
      const offered = product.goldColorOptions.filter((c) => colorAvailable(product, c));
      const options = offered.length > 0 ? offered : product.goldColorOptions;
      const defaultColor =
        product.goldColor && options.includes(product.goldColor)
          ? product.goldColor
          : options.includes('YELLOW')
            ? 'YELLOW'
            : options[0];
      setSelectedGoldColor(defaultColor);
    }
    if (product.sizes.length > 0) {
      const smallestSize = [...product.sizes].sort((a, b) => {
        const na = parseInt(a.label, 10);
        const nb = parseInt(b.label, 10);
        if (Number.isNaN(na) || Number.isNaN(nb)) return 0;
        return na - nb;
      })[0];
      setSelectedSizeId(smallestSize.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const selectedSize = product?.sizes.find((s) => s.id === selectedSizeId) ?? null;
  // A product-level rollup is wrong once a specific size is picked — a
  // product with some in-stock and some out-of-stock sizes must reflect the
  // *selected* size's own stock, not the whole product's availableStock.
  const isOutOfStock = product
    ? product.sizes.length > 0
      ? selectedSize
        ? selectedSize.availableStock <= 0
        : false
      : product.availableStock <= 0
    : false;
  const isLowStock = product ? !isOutOfStock && product.availableStock <= LOW_STOCK_THRESHOLD : false;

  const displayPrice = pricePreview?.sellingPrice ?? product?.sellingPrice ?? 0;
  const displaySellingPriceOriginal = pricePreview?.sellingPriceOriginal ?? product?.sellingPriceOriginal ?? 0;
  // Server-resolved (pricePreview reflects the exact selected variant;
  // product's own is the base-configuration fallback before any variant is
  // resolved) — never re-derived client-side from raw mrp/sellingPriceOriginal.
  const displayMrp = pricePreview?.strikePrice ?? product?.strikePrice ?? 0;
  const displayGstAmount = pricePreview?.gstAmount ?? product?.priceBreakup.gstAmount ?? 0;
  const displayOfferLabel = pricePreview?.offerLabel ?? product?.offerLabel ?? null;
  const displayOfferBadges = pricePreview?.offerBadges ?? product?.offerBadges ?? [];

  // The live-resolved gold weight for whatever combination is selected (a
  // bigger size can weigh more — see Weight Defaults). Net Weight is the
  // gold alone; Gross Weight adds the stones, which are the same for every
  // combination.
  const displayGoldWeightGrams = pricePreview?.goldWeightGrams ?? product?.goldWeightGrams ?? null;
  const displayStoneWeightCarats = product?.stoneWeightCarats ?? null;
  const displayNetWeightGrams = displayGoldWeightGrams;
  const displayGrossWeightGrams =
    displayGoldWeightGrams != null
      ? Math.round((displayGoldWeightGrams + (displayStoneWeightCarats ?? 0) * GRAMS_PER_CARAT) * 1000) / 1000
      : null;
  const displayBreakup = pricePreview
    ? {
        goldValue: pricePreview.goldValue,
        stoneValue: pricePreview.stoneValue,
        stoneValueOriginal: pricePreview.stoneValueOriginal,
        makingCharge: pricePreview.makingCharge,
        makingChargeOriginal: pricePreview.makingChargeOriginal,
        makingChargeDiscountPercent: pricePreview.makingChargeDiscountPercent,
        stoneDiscountPercent: pricePreview.stoneDiscountPercent,
        gstAmount: pricePreview.gstAmount,
        total: pricePreview.sellingPrice,
      }
    : product?.priceBreakup;

  // Bound to this product so ColorSelector (generic, no product reference)
  // can check real per-product availability without a hardcoded rule.
  const isColorAvailable = (color: GoldColor) => (!product ? true : colorAvailable(product, color));

  return {
    selectedSizeId,
    setSelectedSizeId,
    selectedGoldColor,
    setSelectedGoldColor,
    isColorAvailable,
    selectedPurity,
    selectedVariantId,
    pricePreview,
    selectedSize,
    isOutOfStock,
    isLowStock,
    displayGoldWeightGrams,
    displayStoneWeightCarats,
    displayNetWeightGrams,
    displayGrossWeightGrams,
    displayPrice,
    displayMrp,
    displaySellingPriceOriginal,
    displayGstAmount,
    displayOfferLabel,
    displayOfferBadges,
    displayBreakup,
  };
}
