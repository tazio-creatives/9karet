import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelOrder, type CancelReason } from '../../api/orders';
import type { Order } from '../../api/types';
import { ApiError } from '../../api/client';
import styles from './ReturnRequestSection.module.css';

// Mirrors backend/src/utils/orderStatus.js's REFUND_TIMELINE_DAYS /
// CUSTOMER_CANCELLABLE_ORDER_STATUSES (no shared package between web and
// backend). Only gates the UI — the server re-checks and is the authority.
const REFUND_TIMELINE_DAYS = 7;

const REASON_OPTIONS: { value: CancelReason; label: string }[] = [
  { value: 'ORDERED_BY_MISTAKE', label: 'Ordered by mistake' },
  { value: 'BETTER_PRICE', label: 'Found a better price' },
  { value: 'DELIVERY_TOO_SLOW', label: 'Delivery time too long' },
  { value: 'CHANGED_MIND', label: 'Changed my mind' },
  { value: 'OTHER', label: 'Other' },
];

function formatAmount(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Whether the order page should show this card at all: while cancellable
// (paid, not yet processing), or afterwards to show refund progress.
export function shouldShowCancelSection(order: Order) {
  if (order.orderStatus === 'CONFIRMED' && order.paymentStatus === 'PAID') return true;
  return order.orderStatus === 'CANCELLED' && (order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED');
}

export function CancelOrderSection({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState<CancelReason>('ORDERED_BY_MISTAKE');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () => cancelOrder(order.id, { reason, note: note.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowForm(false);
    },
  });

  if (order.orderStatus === 'CANCELLED') {
    return (
      <div className={styles.statusCard}>
        <p className={styles.statusLine}>
          {order.paymentStatus === 'REFUNDED' ? 'Refund processed' : 'Order cancelled — refund in progress'}
        </p>
        <p className={styles.meta}>
          {order.paymentStatus === 'REFUNDED'
            ? `${formatAmount(order.totalAmount)} has been refunded to your original payment method.`
            : `${formatAmount(order.totalAmount)} will be credited back to your original payment method within ${REFUND_TIMELINE_DAYS} days of cancellation.`}
        </p>
      </div>
    );
  }

  if (!showForm) {
    return (
      <>
        <p className={styles.meta}>You can cancel this order until we start processing it.</p>
        <button type="button" className={styles.cancelButton} onClick={() => setShowForm(true)}>
          Cancel Order
        </button>
      </>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <label className={styles.field}>
        Reason for cancellation
        <select value={reason} onChange={(e) => setReason(e.target.value as CancelReason)}>
          {REASON_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Anything you'd like us to know…"
        />
      </label>
      <p className={styles.meta}>
        Your refund of <strong>{formatAmount(order.totalAmount)}</strong> will be credited back to your original
        payment method within {REFUND_TIMELINE_DAYS} days. You'll also receive a cancellation confirmation email.
      </p>
      {mutation.isError && (
        <p className={styles.error}>
          {mutation.error instanceof ApiError ? mutation.error.message : 'Could not cancel this order.'}
        </p>
      )}
      <div className={styles.formActions}>
        <button type="submit" className={styles.requestButton} disabled={mutation.isPending}>
          {mutation.isPending ? 'Cancelling…' : 'Confirm Cancellation'}
        </button>
        <button type="button" className={styles.cancelButton} onClick={() => setShowForm(false)}>
          Keep Order
        </button>
      </div>
    </form>
  );
}
