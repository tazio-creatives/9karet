import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import type { Wishlist } from '../api/types';
import { fetchWishlist, addWishlistItem, removeWishlistItem } from '../api/wishlist';
import styles from './WishlistButton.module.css';

// Shared by every product-card-shaped surface (homepage carousels, PLP grid)
// — reads/writes the same ['wishlist'] query cache everywhere so toggling
// on one screen stays in sync on the others without an extra refetch.
export function WishlistButton({ productId, className }: { productId: string; className?: string }) {
  const queryClient = useQueryClient();
  const { data: wishlistData } = useQuery({ queryKey: ['wishlist'], queryFn: fetchWishlist });
  const isWishlisted = wishlistData?.items.some((i) => i.productId === productId) ?? false;

  const toggleMutation = useMutation({
    mutationFn: () => (isWishlisted ? removeWishlistItem(productId) : addWishlistItem(productId)),
    onSuccess: (wishlist: Wishlist) => queryClient.setQueryData(['wishlist'], wishlist),
  });

  return (
    <button
      type="button"
      className={`${styles.button} ${className ?? ''}`}
      disabled={toggleMutation.isPending}
      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={isWishlisted}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMutation.mutate();
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={isWishlisted ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M12 21s-7.5-4.7-10-9.3C.5 8.1 2.3 4.5 6 4c2-.3 3.7.6 6 3 2.3-2.4 4-3.3 6-3 3.7.5 5.5 4.1 4 7.7C19.5 16.3 12 21 12 21z" />
      </svg>
    </button>
  );
}
