import { useState } from 'react';
import { trackAddToCart } from '../analytics/ecommerce';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchProductBySlug, fetchRelatedProducts, fetchMostLovedProducts } from '../api/products';
import { fetchCategories } from '../api/categories';
import { addCartItem } from '../api/cart';
import type { Cart, ProductImage } from '../api/types';
import { getAncestorChain } from '../utils/categoryTree';
import { useVariantSelection } from '../hooks/useVariantSelection';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useHead, defaultHead } from '../seo/head';
import { breadcrumbJsonLd, organizationJsonLd, productJsonLd } from '../seo/jsonLd';
import { jewelleryType, productImageAlt, productSeoDescription, productSeoTitle } from '../seo/productSeo';
import { ImageGallery } from '../features/pdp/ImageGallery';
import { ProductInfo } from '../features/pdp/ProductInfo';
import { ProductTabs } from '../features/pdp/ProductTabs';
import { RelatedProducts } from '../features/pdp/RelatedProducts';
import styles from './PDPPage.module.css';
import placeholderStyles from './PlaceholderPage.module.css';

// Moves the Product Size Image group to gallery position 3 (index 2) when
// >=2 other photos exist, or right after whichever fewer exist otherwise —
// by reassigning fresh sortOrder values on a LOCAL COPY only (never written
// back to the API/DB). This is the only lever that works: ImageGallery's
// own groupPhotos() always re-sorts by sortOrder regardless of array order,
// so reordering the array alone would do nothing. Depends on at most one
// PRODUCT_SIZE group ever being present, which the backend guarantees (a
// stale/ineligible one is already excluded server-side — see
// productsService.js's attachProductSizeImage). No-op when there is none.
function reorderForProductSize(images: ProductImage[]): ProductImage[] {
  const sizeRows = images.filter((i) => i.type === 'PRODUCT_SIZE');
  if (sizeRows.length === 0) return images;

  const others = images.filter((i) => i.type !== 'PRODUCT_SIZE');
  const otherSortValues = [...new Set(others.map((i) => i.sortOrder))].sort((a, b) => a - b);
  const insertAt = Math.min(2, otherSortValues.length);

  const remap = new Map<number, number>();
  otherSortValues.slice(0, insertAt).forEach((so, i) => remap.set(so, i));
  otherSortValues.slice(insertAt).forEach((so, i) => remap.set(so, insertAt + 1 + i));

  return [
    ...others.map((i) => ({ ...i, sortOrder: remap.get(i.sortOrder) as number })),
    ...sizeRows.map((i) => ({ ...i, sortOrder: insertAt })),
  ];
}

export function PDPPage() {
  const { productSlug } = useParams<{ categorySlug: string; productSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [justAdded, setJustAdded] = useState(false);

  const {
    data: productData,
    isLoading: isProductLoading,
    isError: isProductError,
  } = useQuery({
    queryKey: ['product', productSlug],
    queryFn: () => fetchProductBySlug(productSlug as string),
    enabled: !!productSlug,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });

  const { data: relatedData } = useQuery({
    queryKey: ['related-products', productSlug],
    queryFn: () => fetchRelatedProducts(productSlug as string),
    enabled: !!productSlug,
  });

  const { data: mostLovedData } = useQuery({
    queryKey: ['most-loved-products', productSlug],
    queryFn: () => fetchMostLovedProducts(productSlug as string),
    enabled: !!productSlug,
  });

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
    selectedSize,
    isOutOfStock,
    isLowStock,
    selectedDiamondOption,
    displayGoldWeightGrams,
    displayNetWeightGrams,
    displayGrossWeightGrams,
    displayDiamondWeightCarats,
    displayPrice,
    displayMrp,
    displayGstAmount,
    displayOfferLabel,
    displayOfferBadges,
    displayBreakup,
  } = useVariantSelection(productData?.product);

  const addToCartMutation = useMutation({
    mutationFn: ({ productId, variantId }: { productId: string; variantId?: string | null }) =>
      addCartItem(productId, 1, variantId),
    onSuccess: (cart: Cart, { productId, variantId }) => {
      const prevCart = queryClient.getQueryData<Cart>(['cart']);
      queryClient.setQueryData(['cart'], cart);
      trackAddToCart({ prevCart, nextCart: cart, productId, variantId, quantity: 1 });
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    },
  });

  const product = productData?.product;
  const categories = categoriesData?.categories ?? [];
  const category = product ? (categories.find((c) => c.id === product.categoryId) ?? null) : null;
  const ancestors = category ? getAncestorChain(categories, category) : [];

  const breadcrumbs: { label: string; href?: string }[] = product
    ? [...ancestors.map((c) => ({ label: c.name, href: `/${c.slug}` })), { label: product.name }]
    : [];

  const canonicalPath = product
    ? category
      ? `/${category.slug}/${product.slug}`
      : `/${product.slug}`
    : defaultHead.canonicalPath;

  // Jewellery type from the top-level category ("Rings" -> "Ring").
  const type = jewelleryType(ancestors[0]?.name ?? category?.name);

  // Called unconditionally (rules of hooks) — falls back to defaultHead
  // until the product query resolves, then reflects the real product.
  useHead(
    product
      ? {
          title: product.metaTitle || productSeoTitle(product, type),
          description: product.metaDescription || product.shortDescription || productSeoDescription(product, type),
          canonicalPath,
          jsonLd: [
            organizationJsonLd(),
            breadcrumbJsonLd([{ name: 'Home', path: '/' }, ...breadcrumbs.map((b) => ({ name: b.label, path: b.href ?? canonicalPath }))]),
            productJsonLd(product, canonicalPath),
          ],
        }
      : defaultHead,
  );

  if (isProductLoading) {
    return (
      <div className={styles.page} aria-busy="true">
        <div className={styles.pageInner}>
          <div className={styles.hero}>
            <div className={styles.skeletonCrumb} />

            <div className={styles.layout}>
              <div className={styles.skeletonImage} />
              <div className={styles.skeletonInfo}>
                <div className={styles.skeletonLine} style={{ width: '80%', height: 32 }} />
                <div className={styles.skeletonLine} style={{ width: '40%' }} />
                <div className={styles.skeletonLine} style={{ width: '55%', height: 28 }} />
                <div className={styles.skeletonLine} style={{ width: '90%' }} />
                <div className={styles.skeletonLine} style={{ width: '70%' }} />
                <div className={styles.skeletonLine} style={{ width: '100%', height: 54 }} />
              </div>
            </div>

            <div className={styles.detailsGrid}>
              <div className={styles.skeletonCard} />
              <div className={styles.skeletonCard} />
            </div>
          </div>

          <div className={styles.skeletonTabs} />
          <div className={styles.skeletonTrust} />
        </div>
      </div>
    );
  }

  if (isProductError || !productData || !product) {
    return (
      <div className={placeholderStyles.container}>
        <h1 className={placeholderStyles.heading}>Product not found</h1>
        <p className={placeholderStyles.body}>We couldn't find that piece.</p>
      </div>
    );
  }

  // The manually-uploaded thumbnail is only a placeholder until AI Studio
  // shots exist — once they do, the gallery should show those instead of
  // the manual original. `product.images` itself stays untouched (Buy Now's
  // thumbnail lookup and the JSON-LD structured data both rely on it still
  // containing the primary flag/manual image).
  const hasAiGeneratedImage = product.images.some((img) => img.type === 'AI_GENERATED');
  const galleryImages = reorderForProductSize(
    hasAiGeneratedImage ? product.images.filter((img) => !(img.type === 'ORIGINAL' && img.isPrimary)) : product.images,
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.hero}>
          <Breadcrumbs items={breadcrumbs} />

          <div className={styles.layout}>
            <ImageGallery
              images={galleryImages}
              productName={product.name}
              imageAlt={productImageAlt(product, type)}
              productId={product.id}
              isNew={product.isNew}
            />

            <ProductInfo
              product={product}
              isOutOfStock={isOutOfStock}
              isLowStock={isLowStock}
              justAdded={justAdded}
              isAddingToCart={addToCartMutation.isPending}
              selectedSizeId={selectedSizeId}
              onSelectSize={setSelectedSizeId}
              selectedGoldColor={selectedGoldColor}
              onSelectGoldColor={setSelectedGoldColor}
              isColorAvailableAtPurity={isColorAvailableAtPurity}
              selectedPurity={selectedPurity}
              onSelectPurity={setSelectedPurity}
              isPurityAvailable={isPurityAvailable}
              selectedDiamondConfigId={selectedDiamondConfigId}
              onSelectDiamondConfigId={setSelectedDiamondConfigId}
              isDiamondAvailableAtPurity={isDiamondAvailableAtPurity}
              displayPrice={displayPrice}
              displayMrp={displayMrp}
              offerLabel={displayOfferLabel}
              offerBadges={displayOfferBadges}
              displayBreakup={displayBreakup ?? product.priceBreakup}
              displayGoldWeightGrams={displayGoldWeightGrams}
              displayNetWeightGrams={displayNetWeightGrams}
              displayGrossWeightGrams={displayGrossWeightGrams}
              displayDiamondWeightCarats={displayDiamondWeightCarats}
              onAddToCart={() =>
                addToCartMutation.mutate({
                  productId: product.id,
                  variantId: selectedVariantId,
                })
              }
              onBuyNow={() =>
                navigate('/checkout', {
                  state: {
                    buyNow: {
                      productId: product.id,
                      variantId: selectedVariantId,
                      quantity: 1,
                      name: product.name,
                      slug: product.slug,
                      categorySlug: category?.slug ?? null,
                      sellingPrice: displayPrice,
                      gstAmount: displayGstAmount,
                      primaryImageUrl:
                        product.images.find((img) => img.isPrimary && img.variant === 'small')?.url ?? null,
                      availableStock: product.availableStock,
                      sizeLabel: selectedSize?.label ?? null,
                      goldColor: selectedGoldColor ?? null,
                      purity: selectedPurity ?? null,
                      diamondConfigName: selectedDiamondOption?.name ?? null,
                      isBackordered: isOutOfStock,
                      deliveryEstimate: product.deliveryEstimate,
                    },
                  },
                })
              }
            />
          </div>
        </div>

        <ProductTabs product={product} />

        <RelatedProducts products={relatedData?.products ?? []} categorySlug={category?.slug ?? null} />

        <RelatedProducts
          products={mostLovedData?.products ?? []}
          categorySlug={category?.slug ?? null}
          heading="Most Loved"
        />
      </div>
    </div>
  );
}
