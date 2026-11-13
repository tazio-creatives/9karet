import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchAdminReviews, approveReview, rejectReview, resetReviewToPending } from '../../api/reviews';
import type { AdminReview, ReviewStatus } from '../../api/types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import sharedStyles from '../../styles/shared.module.css';
import styles from './ReviewsListPage.module.css';

const STATUSES: ReviewStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

const STATUS_CLASS: Record<ReviewStatus, string> = {
  PENDING: 'badgeWarning',
  APPROVED: 'badgeSuccess',
  REJECTED: 'badgeDanger',
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className={styles.stars}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  );
}

export function ReviewsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // The URL param is missing on first load (defaults to Pending) vs.
  // explicitly cleared to "All statuses" (must stay empty) — those are
  // different states, so only a truly-absent param falls back to Pending.
  const rawStatus = searchParams.get('status');
  const status = (rawStatus === null ? 'PENDING' : rawStatus) as ReviewStatus | '';
  const [page, setPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<{
    type: 'approve' | 'reject' | 'reset';
    review: AdminReview;
  } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews', { status, page }],
    queryFn: () => fetchAdminReviews(status || undefined, page, 20),
  });

  const approveMutation = useMutation({
    mutationFn: approveReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      setPendingAction(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      setPendingAction(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetReviewToPending,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      setPendingAction(null);
    },
  });

  const anyMutationPending = approveMutation.isPending || rejectMutation.isPending || resetMutation.isPending;

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>Reviews</h1>
      </div>

      <div className={styles.filters}>
        <select
          value={status}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams);
            // Always keep the param present (even as '') so "All statuses"
            // round-trips distinctly from a first-load/absent param.
            next.set('status', e.target.value);
            setSearchParams(next);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className={sharedStyles.card}>
        {isLoading && <p className={sharedStyles.empty}>Loading…</p>}
        {!isLoading && data && data.reviews.length === 0 && (
          <p className={sharedStyles.empty}>No reviews match this filter.</p>
        )}
        {!isLoading && data && data.reviews.length > 0 && (
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Rating</th>
                <th>Review</th>
                <th>Reviewer</th>
                <th>Status</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.reviews.map((review) => (
                <tr key={review.id}>
                  <td>{review.productName}</td>
                  <td>
                    <Stars rating={review.rating} />
                  </td>
                  <td className={styles.reviewCell}>
                    {review.title && <p className={styles.reviewTitle}>{review.title}</p>}
                    {review.body && <p className={styles.reviewBody}>{review.body}</p>}
                    {review.images.length > 0 && (
                      <div className={styles.reviewImages}>
                        {review.images.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="" className={styles.reviewImageThumb} />
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {review.reviewerName}
                    <div className={styles.mobile}>{review.reviewerMobile}</div>
                  </td>
                  <td>
                    <span className={sharedStyles[STATUS_CLASS[review.status]]}>{review.status}</span>
                  </td>
                  <td>{new Date(review.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <div className={styles.actions}>
                      {review.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            className={sharedStyles.buttonPrimary}
                            disabled={anyMutationPending}
                            onClick={() => setPendingAction({ type: 'approve', review })}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className={sharedStyles.buttonDanger}
                            disabled={anyMutationPending}
                            onClick={() => setPendingAction({ type: 'reject', review })}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {review.status !== 'PENDING' && (
                        <button
                          type="button"
                          className={sharedStyles.button}
                          disabled={anyMutationPending}
                          onClick={() => setPendingAction({ type: 'reset', review })}
                        >
                          Reset to Pending
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className={sharedStyles.pagination}>
          <button type="button" className={sharedStyles.button} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <button
            type="button"
            className={sharedStyles.button}
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {pendingAction && (
        <ConfirmDialog
          title={
            pendingAction.type === 'approve'
              ? 'Approve review'
              : pendingAction.type === 'reject'
                ? 'Reject review'
                : 'Reset to Pending'
          }
          message={
            pendingAction.type === 'approve'
              ? `Approve this review by ${pendingAction.review.reviewerName} for "${pendingAction.review.productName}"? It will go live on the product page.`
              : pendingAction.type === 'reject'
                ? `Reject this review by ${pendingAction.review.reviewerName} for "${pendingAction.review.productName}"? It will not be published.`
                : `Move this ${pendingAction.review.status.toLowerCase()} review by ${pendingAction.review.reviewerName} for "${pendingAction.review.productName}" back to Pending? ${
                    pendingAction.review.status === 'APPROVED'
                      ? "It will be taken off the product page until it's re-approved."
                      : "It will need to be reviewed again."
                  }`
          }
          confirmLabel={pendingAction.type === 'approve' ? 'Approve' : pendingAction.type === 'reject' ? 'Reject' : 'Reset to Pending'}
          danger={pendingAction.type === 'reject'}
          isPending={anyMutationPending}
          onConfirm={() => {
            if (pendingAction.type === 'approve') approveMutation.mutate(pendingAction.review.id);
            else if (pendingAction.type === 'reject') rejectMutation.mutate(pendingAction.review.id);
            else resetMutation.mutate(pendingAction.review.id);
          }}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
