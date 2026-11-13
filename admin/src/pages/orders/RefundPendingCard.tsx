import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markOrderRefunded } from '../../api/orders';
import type { OrderDetail } from '../../api/types';
import { ApiError } from '../../api/client';
import { formatPrice } from '../../utils/formatPrice';
import sharedStyles from '../../styles/shared.module.css';
import { PaymentDetails } from './PaymentDetails';

// A cancelled/returned order whose payment is still PAID owes the customer a
// refund. Refunds are issued by hand from the Cashfree dashboard; this card
// flags them and records completion (payment status -> REFUNDED).
export function isRefundPending(order: OrderDetail) {
  return (order.orderStatus === 'CANCELLED' || order.orderStatus === 'RETURNED') && order.paymentStatus === 'PAID';
}

export function RefundPendingCard({ order }: { order: OrderDetail }) {
  const queryClient = useQueryClient();
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => markOrderRefunded(order.id, reference.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not mark this order as refunded.'),
  });

  return (
    <section
      className={sharedStyles.cardPadded}
      style={{ borderLeft: '4px solid var(--color-warning)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <span className={sharedStyles.badgeWarning}>Refund pending</span>
        <strong>{formatPrice(order.totalAmount)}</strong>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        This order is {order.orderStatus === 'CANCELLED' ? 'cancelled' : 'returned'} but the payment hasn&apos;t been
        refunded yet. In the Cashfree dashboard, search this Transaction ID (or the order ID), issue the refund
        (customer was promised it within 7 days), then mark it here with the refund reference.
      </p>
      <PaymentDetails order={order} />
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Cashfree refund ID / UTR (optional)"
          maxLength={100}
          style={{ flex: '1 1 220px' }}
        />
        <button
          type="button"
          className={sharedStyles.buttonPrimary}
          disabled={mutation.isPending}
          onClick={() => {
            setError(null);
            if (window.confirm(`Confirm the refund of ${formatPrice(order.totalAmount)} has been issued in Cashfree?`)) {
              mutation.mutate();
            }
          }}
        >
          {mutation.isPending ? 'Saving…' : 'Mark as Refunded'}
        </button>
      </div>
      {error && <p className={sharedStyles.error}>{error}</p>}
    </section>
  );
}
