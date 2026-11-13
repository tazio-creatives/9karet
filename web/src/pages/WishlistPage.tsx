import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchWishlist, removeWishlistItem } from '../api/wishlist';
import { PlpProductCard } from '../components/PlpProductCard';
import { QuickAddSheet } from '../features/plp/QuickAddSheet';
import { useQuickAdd } from '../features/plp/useQuickAdd';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import styles from './WishlistPage.module.css';
import placeholderStyles from './PlaceholderPage.module.css';

export function WishlistPage() {
  useDocumentTitle('Wishlist');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['wishlist'], queryFn: fetchWishlist });

  // Once an item actually lands in the cart, it moves out of the wishlist —
  // same "Move to Bag" semantics the old hand-rolled card had.
  const removeMutation = useMutation({
    mutationFn: (productId: string) => removeWishlistItem(productId),
    onSuccess: (wishlist) => queryClient.setQueryData(['wishlist'], wishlist),
  });
  const quickAdd = useQuickAdd((productId) => removeMutation.mutate(productId));

  if (isLoading) {
    return (
      <div className={styles.page} aria-busy="true">
        <h1 className={styles.heading}>Wishlist</h1>
        <div className={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className={placeholderStyles.container}>
        <h1 className={placeholderStyles.heading}>Wishlist</h1>
        <p className={placeholderStyles.body}>Your wishlist is empty.</p>
        <Link to="/" className={styles.continueLink}>
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Wishlist</h1>

      <div className={styles.grid}>
        {data.items.map((item, i) => (
          <PlpProductCard
            key={item.productId}
            product={item}
            index={i}
            onAddToCart={() => quickAdd.addToCart(item)}
            isAdding={quickAdd.pendingProductId === item.productId}
            justAdded={quickAdd.justAddedProductId === item.productId}
            hasError={quickAdd.errorProductId === item.productId}
          />
        ))}
      </div>

      {quickAdd.sheetProduct && (
        <QuickAddSheet
          product={quickAdd.sheetProduct}
          onClose={quickAdd.closeSheet}
          onAdded={(productId) => removeMutation.mutate(productId)}
        />
      )}
    </div>
  );
}
