import type { UseMutationResult } from '@tanstack/react-query';
import type { OrderDetail, OrderStatus } from '../../api/types';
import { ADMIN_MANUAL_TARGETS, formatOrderStatus } from '../../utils/orderStatus';
import { RefreshIcon, InfoIcon } from './OrderHeroIcons';
import styles from './ChangeStatusCard.module.css';

const NOTE_MAX_LENGTH = 250;
const TERMINAL_ORDER_STATUSES = new Set(['DELIVERED', 'CANCELLED', 'RETURNED']);

interface ChangeStatusCardProps {
  order: OrderDetail;
  statusDraft: OrderStatus | '';
  setStatusDraft: (_v: OrderStatus | '') => void;
  statusNote: string;
  setStatusNote: (_v: string) => void;
  statusMutation: UseMutationResult<{ order: OrderDetail }, unknown, OrderStatus>;
  startProcessingMutation: UseMutationResult<{ order: OrderDetail }, unknown, void>;
}

// Compact-panel-only version of "Change Order Status" — unlike the
// standalone full-page view (which applies a status change immediately on
// selection, no separate confirm step), this uses an explicit "Update
// Status" submit button, matching the panel's own design spec.
export function ChangeStatusCard({
  order,
  statusDraft,
  setStatusDraft,
  statusNote,
  setStatusNote,
  statusMutation,
  startProcessingMutation,
}: ChangeStatusCardProps) {
  const isTerminal = order.orderStatus !== null && TERMINAL_ORDER_STATUSES.has(order.orderStatus);

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <span className={styles.iconCircle}>
          <RefreshIcon size={15} />
        </span>
        <div className={styles.headerText}>
          <h2 className={styles.title}>Change Order Status</h2>
          <p className={styles.subtitle}>Update the order status and add a note if needed.</p>
        </div>
        <span className={styles.orderNumber}>{order.orderNumber}</span>
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
          className={styles.updateButton}
          disabled={startProcessingMutation.isPending}
          onClick={() => startProcessingMutation.mutate()}
        >
          <RefreshIcon size={14} />
          {startProcessingMutation.isPending ? 'Starting…' : 'Start Processing'}
        </button>
      )}

      {order.orderStatus !== null && order.orderStatus !== 'CONFIRMED' && !isTerminal && (
        <>
          <label className={styles.field}>
            New Status
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
          </label>

          <label className={styles.field}>
            Note (optional)
            <textarea
              className={styles.textarea}
              placeholder="Add a note about this status change…"
              value={statusNote}
              maxLength={NOTE_MAX_LENGTH}
              disabled={statusMutation.isPending}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={3}
            />
            <span className={styles.charCount}>
              {statusNote.length}/{NOTE_MAX_LENGTH}
            </span>
          </label>

          <div className={styles.footer}>
            <p className={styles.footerHint}>
              <InfoIcon /> Status updates will be visible to the customer.
            </p>
            <button
              type="button"
              className={styles.updateButton}
              disabled={!statusDraft || statusMutation.isPending}
              onClick={() => statusDraft && statusMutation.mutate(statusDraft)}
            >
              <RefreshIcon size={14} />
              {statusMutation.isPending ? 'Updating…' : 'Update Status'}
            </button>
          </div>
        </>
      )}

      {isTerminal && <p className={styles.hint}>{formatOrderStatus(order.orderStatus)} is a final status.</p>}
    </section>
  );
}
