import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchReturnRequest, createReturnRequest, cancelReturnRequest } from '../../api/orders';
import type { ReturnReason } from '../../api/types';
import { ApiError } from '../../api/client';
import styles from './ReturnRequestSection.module.css';

// Mirrors backend/src/utils/orderStatus.js's RETURN_WINDOW_DAYS (no shared
// package between web/backend — kept in sync by hand, same as every other
// status constant this admin/web split already duplicates). Only gates the
// UI; the server re-checks this independently and is the real authority.
const RETURN_WINDOW_DAYS = 7;

const REASON_OPTIONS: { value: ReturnReason; label: string }[] = [
  { value: 'DAMAGED', label: 'Item arrived damaged' },
  { value: 'DEFECTIVE', label: 'Item is defective' },
  { value: 'WRONG_ITEM', label: 'Wrong item received' },
  { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
  { value: 'CHANGED_MIND', label: 'Changed my mind' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Return requested — under review',
  APPROVED: 'Return approved — pickup will be arranged',
  REJECTED: 'Return request rejected',
  COMPLETED: 'Return completed',
  CANCELLED: 'Return request cancelled',
};

export function ReturnRequestSection({ orderId, deliveredAt }: { orderId: string; deliveredAt: string | null }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState<ReturnReason>('DAMAGED');
  const [note, setNote] = useState('');
  const [video, setVideo] = useState<File | null>(null);
  const [videoMissing, setVideoMissing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['return-request', orderId],
    queryFn: () => fetchReturnRequest(orderId),
  });

  const mutation = useMutation({
    mutationFn: () => createReturnRequest(orderId, { reason, note: note.trim() || undefined, video: video ?? undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-request', orderId] });
      // Submitting also moves order_status to RETURN_INITIATED server-side
      // (see backend orderReturns.controller.js) — refetch the order too so
      // the page's status badge/stepper (a separate query, in
      // OrderDetailPage.tsx) don't keep showing the stale "Delivered" state.
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      setShowForm(false);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelReturnRequest(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-request', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      setConfirmingCancel(false);
    },
  });

  if (!deliveredAt || isLoading) return null;

  const withinWindow = Date.now() - new Date(deliveredAt).getTime() <= RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const returnRequest = data?.returnRequest ?? null;

  return (
    <>
      {returnRequest ? (
        <div className={styles.statusCard}>
          <p className={styles.statusLine}>{STATUS_LABEL[returnRequest.status] ?? returnRequest.status}</p>
          <p className={styles.meta}>
            Reason: {REASON_OPTIONS.find((r) => r.value === returnRequest.reason)?.label ?? returnRequest.reason}
          </p>
          {returnRequest.note && <p className={styles.meta}>Note: {returnRequest.note}</p>}
          {returnRequest.videoUrl && (
            <a href={returnRequest.videoUrl} target="_blank" rel="noreferrer" className={styles.videoLink}>
              View submitted video
            </a>
          )}
          {returnRequest.status === 'REQUESTED' &&
            (confirmingCancel ? (
              <div className={styles.formActions}>
                <span className={styles.meta}>Cancel this return request?</span>
                <button
                  type="button"
                  className={styles.requestButton}
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  {cancelMutation.isPending ? 'Cancelling…' : 'Yes, cancel it'}
                </button>
                <button type="button" className={styles.cancelButton} onClick={() => setConfirmingCancel(false)}>
                  No, keep it
                </button>
              </div>
            ) : (
              <button type="button" className={styles.cancelButton} onClick={() => setConfirmingCancel(true)}>
                Cancel Return Request
              </button>
            ))}
          {cancelMutation.isError && (
            <p className={styles.error}>
              {cancelMutation.error instanceof ApiError ? cancelMutation.error.message : 'Could not cancel return request.'}
            </p>
          )}
        </div>
      ) : !withinWindow ? (
        <p className={styles.closedNote}>The {RETURN_WINDOW_DAYS}-day return window for this order has closed.</p>
      ) : !showForm ? (
        <button type="button" className={styles.requestButton} onClick={() => setShowForm(true)}>
          Request a Return
        </button>
      ) : (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (!video) {
              setVideoMissing(true);
              return;
            }
            mutation.mutate();
          }}
        >
          <label className={styles.field}>
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}>
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
              maxLength={1000}
              rows={3}
              placeholder="Tell us more about the issue…"
            />
          </label>
          <div className={styles.videoNotice}>
            <p className={styles.videoNoticeTitle}>Unboxing video — required</p>
            <p className={styles.meta}>Upload one continuous, unedited video that:</p>
            <ul className={styles.videoChecklist}>
              <li>Starts before the outer package is opened and shows the shipping label</li>
              <li>Records the whole opening without pausing or cutting</li>
              <li>Shows the jewellery box, product, certificate and invoice</li>
            </ul>
          </div>
          <label className={styles.field}>
            Unboxing video <span className={styles.required}>*</span>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
              onChange={(e) => {
                setVideo(e.target.files?.[0] ?? null);
                setVideoMissing(false);
              }}
              aria-invalid={videoMissing}
              required
            />
          </label>
          {videoMissing && (
            <p className={styles.error} role="alert">
              Please upload your unboxing video — it is required for every return.
            </p>
          )}
          {mutation.isError && (
            <p className={styles.error}>
              {mutation.error instanceof ApiError ? mutation.error.message : 'Could not submit return request.'}
            </p>
          )}
          <div className={styles.formActions}>
            <button type="submit" className={styles.requestButton} disabled={mutation.isPending}>
              {mutation.isPending ? 'Submitting…' : 'Submit Return Request'}
            </button>
            <button type="button" className={styles.cancelButton} onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
}
