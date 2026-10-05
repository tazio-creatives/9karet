import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restockOrder } from '../../api/orders';
import type { OrderDetail } from '../../api/types';
import { ApiError } from '../../api/client';
import sharedStyles from '../../styles/shared.module.css';

// A returned order's items stay out of stock until admin confirms the piece
// passed quality check — then this puts them back on sale (one time only).
export function RestockCard({ order }: { order: OrderDetail }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => restockOrder(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not add the items back to stock.'),
  });

  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section
      className={sharedStyles.cardPadded}
      style={{ borderLeft: '4px solid var(--color-info)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      <strong>Returned items not yet back in stock</strong>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        Once the returned piece has passed quality check, add it back to stock so it can be sold again ({units}{' '}
        {units === 1 ? 'unit' : 'units'}). Skip this if the item is damaged or won&apos;t be resold.
      </p>
      <div>
        <button
          type="button"
          className={sharedStyles.button}
          disabled={mutation.isPending}
          onClick={() => {
            setError(null);
            if (window.confirm('Add the returned items back to stock? This can only be done once.')) mutation.mutate();
          }}
        >
          {mutation.isPending ? 'Saving…' : 'Add back to stock'}
        </button>
      </div>
      {error && <p className={sharedStyles.error}>{error}</p>}
    </section>
  );
}
