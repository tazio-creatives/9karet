import type { UseMutationResult } from '@tanstack/react-query';
import type { OrderDetail, OrderStatus } from '../../api/types';
import { ADMIN_MANUAL_TARGETS, formatOrderStatus } from '../../utils/orderStatus';
import { PencilIcon } from './OrderHeroIcons';
import sharedStyles from '../../styles/shared.module.css';
import styles from './ChangeStatusRow.module.css';

const TERMINAL_ORDER_STATUSES = new Set(['DELIVERED', 'CANCELLED', 'RETURNED']);

interface ChangeStatusRowProps {
  order: OrderDetail;
  statusDraft: OrderStatus | '';
  setStatusDraft: (_v: OrderStatus | '') => void;
  statusNote: string;
  setStatusNote: (_v: string) => void;
  statusMutation: UseMutationResult<{ order: OrderDetail }, unknown, OrderStatus>;
  startProcessingMutation: UseMutationResult<{ order: OrderDetail }, unknown, void>;
}

// Full-page-only "Change Order Status" — a single compact row (dropdown +
// note + submit button) rather than the compact panel's stacked
// ChangeStatusCard, matching this page's own design spec. Same underlying
// mutations, just a different shape.
export function ChangeStatusRow({
  order,
  statusDraft,
  setStatusDraft,
  statusNote,
  setStatusNote,
  statusMutation,
  startProcessingMutation,
}: ChangeStatusRowProps) {
  const isTerminal = order.orderStatus !== null && TERMINAL_ORDER_STATUSES.has(order.orderStatus);

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <span className={styles.iconCircle}>
          <PencilIcon size={14} />
        </span>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Change Order Status</h2>
          <p className={styles.subtitle}>Update order status and add an internal note.</p>
        </div>
        <span className={styles.orderNumber}>Order ID: {order.orderNumber}</span>
      </div>

      {order.orderStatus === null && (
        <p className={styles.hint}>
          {order.paymentStatus === 'FAILED'
            ? 'Payment failed — no fulfilment status yet.'
            : 'Waiting on payment confirmation — no fulfilment status yet.'}
        </p>
      )}

      {order.orderStatus === 'CONFIRMED' && (
        <button
          type="button"
          className={sharedStyles.buttonPrimary}
          disabled={startProcessingMutation.isPending}
          onClick={() => startProcessingMutation.mutate()}
        >
          {startProcessingMutation.isPending ? 'Starting…' : 'Start Processing'}
        </button>
      )}

      {order.orderStatus !== null && order.orderStatus !== 'CONFIRMED' && !isTerminal && (
        <div className={styles.row}>
          <select
            className={styles.select}
            value={statusDraft}
            disabled={statusMutation.isPending}
            onChange={(e) => setStatusDraft(e.target.value as OrderStatus | '')}
          >
            <option value="">Set exception status…</option>
            {ADMIN_MANUAL_TARGETS.map((s) => (
              <option key={s} value={s} disabled={s === order.orderStatus}>
                {formatOrderStatus(s)}
                {s === order.orderStatus ? ' (current)' : ''}
              </option>
            ))}
          </select>
          <input
            type="text"
            className={styles.noteInput}
            placeholder="Note (optional)"
            value={statusNote}
            disabled={statusMutation.isPending}
            onChange={(e) => setStatusNote(e.target.value)}
          />
          <button
            type="button"
            className={styles.updateButton}
            disabled={!statusDraft || statusMutation.isPending}
            onClick={() => statusDraft && statusMutation.mutate(statusDraft)}
          >
            {statusMutation.isPending ? 'Updating…' : 'Update Status'}
          </button>
        </div>
      )}

      {isTerminal && <p className={styles.hint}>{formatOrderStatus(order.orderStatus)} is a final status.</p>}
    </section>
  );
}
