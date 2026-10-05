import { useState } from 'react';
import type { ReturnRequest, ReversePickup } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RefreshIcon } from './OrderHeroIcons';
import sharedStyles from '../../styles/shared.module.css';
import contentStyles from './OrderDetailPage.module.css';
import styles from './ReturnRequestCard.module.css';

const REASON_LABELS: Record<ReturnRequest['reason'], string> = {
  DAMAGED: 'Damaged',
  DEFECTIVE: 'Defective',
  WRONG_ITEM: 'Wrong Item',
  NOT_AS_DESCRIBED: 'Not as Described',
  CHANGED_MIND: 'Changed Mind',
  OTHER: 'Other',
};

const STATUS_BADGE: Record<ReturnRequest['status'], keyof typeof sharedStyles> = {
  REQUESTED: 'badgeWarning',
  APPROVED: 'badgeInfo',
  REJECTED: 'badgeDanger',
  COMPLETED: 'badgeSuccess',
  CANCELLED: 'badgeNeutral',
};

const REVERSE_PICKUP_LABELS: Record<ReversePickup['status'], string> = {
  REVERSE_PICKUP_SCHEDULED: 'Pickup Scheduled',
  REVERSE_PICKED_UP: 'Picked Up',
  REVERSE_IN_TRANSIT: 'In Transit to Warehouse',
  REVERSE_RECEIVED: 'Received at Warehouse',
  REVERSE_PICKUP_FAILED: 'Pickup Failed',
  REVERSE_PICKUP_CANCELLED: 'Pickup Cancelled',
};

const REVERSE_PICKUP_BADGE: Record<ReversePickup['status'], keyof typeof sharedStyles> = {
  REVERSE_PICKUP_SCHEDULED: 'badgeInfo',
  REVERSE_PICKED_UP: 'badgeInfo',
  REVERSE_IN_TRANSIT: 'badgeInfo',
  REVERSE_RECEIVED: 'badgeSuccess',
  REVERSE_PICKUP_FAILED: 'badgeDanger',
  REVERSE_PICKUP_CANCELLED: 'badgeNeutral',
};

const REVERSE_PICKUP_TERMINAL = new Set<ReversePickup['status']>(['REVERSE_RECEIVED', 'REVERSE_PICKUP_CANCELLED']);

// Shown in both compact and full order views whenever a customer has
// submitted a return request — a lightweight approve/reject review trail,
// deliberately separate from order_status (which the admin still moves to
// RETURNED via the existing Change Status control once the return is
// physically received and inspected; that transition auto-marks this
// request COMPLETED, see adminOrders.controller.js).
export function ReturnRequestCard({
  returnRequest,
  reversePickup,
  onApprove,
  onReject,
  isPending,
  onSchedulePickup,
  onSyncPickup,
  onSimulatePickup,
  isPickupPending,
}: {
  returnRequest: ReturnRequest;
  reversePickup: ReversePickup | null;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
  onSchedulePickup: () => void;
  onSyncPickup: () => void;
  onSimulatePickup: (_status: ReversePickup['status']) => void;
  isPickupPending: boolean;
}) {
  const [confirmReschedule, setConfirmReschedule] = useState(false);
  const canReschedule =
    reversePickup?.status === 'REVERSE_PICKUP_FAILED' || reversePickup?.status === 'REVERSE_PICKUP_CANCELLED';

  return (
    <section className={sharedStyles.cardPadded}>
      <div className={styles.headingRow}>
        <h2 className={contentStyles.sectionHeadingIcon}>
          <RefreshIcon size={16} /> Return Request
        </h2>
        <span className={sharedStyles[STATUS_BADGE[returnRequest.status]]}>{returnRequest.status}</span>
      </div>

      <div className={styles.detailRow}>
        <span className={styles.label}>Reason</span>
        <span>{REASON_LABELS[returnRequest.reason]}</span>
      </div>
      {returnRequest.note && (
        <div className={styles.detailRow}>
          <span className={styles.label}>Note</span>
          <span>{returnRequest.note}</span>
        </div>
      )}
      <div className={styles.detailRow}>
        <span className={styles.label}>Submitted</span>
        <span>
          {new Date(returnRequest.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>
      {returnRequest.videoUrl && (
        <div className={styles.detailRow}>
          <span className={styles.label}>Unboxing Video</span>
          <a href={returnRequest.videoUrl} target="_blank" rel="noreferrer">
            View video
          </a>
        </div>
      )}
      {!!returnRequest.photoUrls?.length && (
        <div className={styles.detailRow}>
          <span className={styles.label}>Photos ({returnRequest.photoUrls.length})</span>
          <span className={styles.photoGrid}>
            {returnRequest.photoUrls.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" title={`Open photo ${i + 1}`}>
                <img src={url} alt={`Return photo ${i + 1}`} className={styles.photoThumb} />
              </a>
            ))}
          </span>
        </div>
      )}
      {returnRequest.resolvedAt && (
        <div className={styles.detailRow}>
          <span className={styles.label}>Resolved</span>
          <span>
            {new Date(returnRequest.resolvedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            {returnRequest.resolvedByAdminName ? ` by ${returnRequest.resolvedByAdminName}` : ''}
          </span>
        </div>
      )}

      {returnRequest.status === 'REQUESTED' && (
        <div className={styles.actions}>
          <button type="button" className={sharedStyles.buttonPrimary} disabled={isPending} onClick={onApprove}>
            Approve
          </button>
          <button type="button" className={sharedStyles.buttonDanger} disabled={isPending} onClick={onReject}>
            Reject
          </button>
        </div>
      )}

      {/* Reverse pickup only ever applies once the return is APPROVED — the
          backend rejects scheduling it any earlier (or later, once the
          decision has moved on to Rejected/Cancelled/Completed). */}
      {returnRequest.status === 'APPROVED' && (
        <div className={styles.pickupSection}>
          <div className={styles.headingRow}>
            <h3 className={styles.pickupHeading}>Reverse Pickup</h3>
            {reversePickup && (
              <span className={sharedStyles[REVERSE_PICKUP_BADGE[reversePickup.status]]}>
                {REVERSE_PICKUP_LABELS[reversePickup.status]}
              </span>
            )}
          </div>

          {reversePickup ? (
            <>
              <div className={styles.detailRow}>
                <span className={styles.label}>Courier</span>
                <span>{reversePickup.courierName ?? '—'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>AWB</span>
                <span>{reversePickup.trackingNumber ?? '—'}</span>
              </div>
              {reversePickup.lastTrackedAt && (
                <div className={styles.detailRow}>
                  <span className={styles.label}>Last synced</span>
                  <span>
                    {new Date(reversePickup.lastTrackedAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              )}
              {!REVERSE_PICKUP_TERMINAL.has(reversePickup.status) && (
                <div className={styles.actions}>
                  {reversePickup.provider === 'stub' ? (
                    <>
                      <button
                        type="button"
                        className={sharedStyles.button}
                        disabled={isPickupPending || reversePickup.status === 'REVERSE_PICKED_UP'}
                        onClick={() => onSimulatePickup('REVERSE_PICKED_UP')}
                      >
                        Mark Picked Up
                      </button>
                      <button
                        type="button"
                        className={sharedStyles.button}
                        disabled={isPickupPending}
                        onClick={() => onSimulatePickup('REVERSE_RECEIVED')}
                      >
                        Mark Received at Warehouse
                      </button>
                      {reversePickup.status !== 'REVERSE_PICKUP_FAILED' && (
                        <button
                          type="button"
                          className={sharedStyles.button}
                          disabled={isPickupPending}
                          onClick={() => onSimulatePickup('REVERSE_PICKUP_FAILED')}
                        >
                          Mark Pickup Failed
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      className={sharedStyles.button}
                      disabled={isPickupPending}
                      onClick={onSyncPickup}
                    >
                      {isPickupPending ? 'Refreshing…' : 'Refresh Tracking'}
                    </button>
                  )}
                </div>
              )}
              {canReschedule && (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={sharedStyles.buttonPrimary}
                    disabled={isPickupPending}
                    onClick={() => setConfirmReschedule(true)}
                  >
                    {isPickupPending ? 'Scheduling…' : 'Schedule New Pickup'}
                  </button>
                </div>
              )}
              <p className={styles.pickupInfoBox}>
                {canReschedule
                  ? reversePickup.status === 'REVERSE_PICKUP_FAILED'
                    ? 'The courier could not collect this return. Schedule a new pickup — the failed one is cancelled with the courier first so two agents are not sent.'
                    : 'This pickup was cancelled. Schedule a new pickup to collect the return.'
                  : reversePickup.provider === 'stub'
                  ? 'Stub courier provider — these buttons simulate what a real courier would report.'
                  : 'Tracking syncs automatically every few minutes, or use Refresh Tracking to check now.'}
              </p>
            </>
          ) : (
            <div className={styles.actions}>
              <button
                type="button"
                className={sharedStyles.buttonPrimary}
                disabled={isPickupPending}
                onClick={onSchedulePickup}
              >
                {isPickupPending ? 'Scheduling…' : 'Schedule Reverse Pickup'}
              </button>
            </div>
          )}
        </div>
      )}
      {confirmReschedule && reversePickup && (
        <ConfirmDialog
          title="Schedule a new pickup?"
          message={
            reversePickup.status === 'REVERSE_PICKUP_FAILED'
              ? `AWB ${reversePickup.trackingNumber ?? ''} will be cancelled with the courier and a new reverse pickup booked from the customer's address.`
              : "A new reverse pickup will be booked from the customer's address."
          }
          confirmLabel="Schedule New Pickup"
          isPending={isPickupPending}
          onConfirm={() => {
            setConfirmReschedule(false);
            onSchedulePickup();
          }}
          onCancel={() => setConfirmReschedule(false)}
        />
      )}
    </section>
  );
}
