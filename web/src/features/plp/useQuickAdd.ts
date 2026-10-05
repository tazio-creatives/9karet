import { useState } from 'react';
import { trackAddToCart } from '../../analytics/ecommerce';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { ProductCard as ProductCardType, ProductDetail, Cart } from '../../api/types';
import { fetchProductBySlug } from '../../api/products';
import { addCartItem } from '../../api/cart';

// Owned once by ProductListing, shared across every PlpProductCard — decides
// per-tap whether a product can be added directly or needs the QuickAddSheet
// (mandatory gold color / purity / diamond quality / size), by fetching the
// same full product detail the PDP itself uses (same query key, so it's
// instant from cache if the shopper already visited that PDP this session).
//
// onAdded is optional — the Wishlist page passes it to also remove the item
// from the wishlist once it's actually in the cart ("Move to Bag" semantics);
// the plain PLP grid has no wishlist context to clean up, so it omits it.
export function useQuickAdd(onAdded?: (_productId: string) => void) {
  const queryClient = useQueryClient();
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [justAddedProductId, setJustAddedProductId] = useState<string | null>(null);
  const [errorProductId, setErrorProductId] = useState<string | null>(null);
  const [sheetProduct, setSheetProduct] = useState<ProductDetail | null>(null);

  const directAddMutation = useMutation({
    mutationFn: (productId: string) => addCartItem(productId, 1),
    onSuccess: (cart: Cart, productId) => {
      const prevCart = queryClient.getQueryData<Cart>(['cart']);
      queryClient.setQueryData(['cart'], cart);
      trackAddToCart({ prevCart, nextCart: cart, productId, quantity: 1 });
      setJustAddedProductId(productId);
      setTimeout(() => setJustAddedProductId((cur) => (cur === productId ? null : cur)), 2000);
      onAdded?.(productId);
    },
    onError: (_err, productId) => {
      setErrorProductId(productId);
      setTimeout(() => setErrorProductId((cur) => (cur === productId ? null : cur)), 3000);
    },
    onSettled: () => setPendingProductId(null),
  });

  async function addToCart(product: ProductCardType) {
    setPendingProductId(product.id);
    setErrorProductId(null);
    try {
      const { product: detail } = await queryClient.fetchQuery({
        queryKey: ['product', product.slug],
        queryFn: () => fetchProductBySlug(product.slug),
      });
      const hasCustomizations =
        detail.goldColorOptions.length > 0 ||
        detail.purityOptions.length > 0 ||
        detail.diamondOptions.length > 0 ||
        detail.sizes.length > 0;
      if (hasCustomizations) {
        setSheetProduct(detail);
        setPendingProductId(null);
      } else {
        directAddMutation.mutate(product.id);
      }
    } catch {
      setErrorProductId(product.id);
      setPendingProductId(null);
      setTimeout(() => setErrorProductId((cur) => (cur === product.id ? null : cur)), 3000);
    }
  }

  return {
    addToCart,
    pendingProductId,
    justAddedProductId,
    errorProductId,
    sheetProduct,
    closeSheet: () => setSheetProduct(null),
  };
}
