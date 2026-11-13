import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitReview, updateReview } from '../../api/reviews';
import { ApiError } from '../../api/client';
import type { OwnOrderItemReview } from '../../api/types';
import { ReviewFormModal } from './ReviewFormModal';
import { ImageLightbox } from '../../components/ImageLightbox';
import styles from './WriteReviewButton.module.css';

interface WriteReviewButtonProps {
  productId: string;
  productName: string;
  orderItemId: string;
  orderId: string;
  canReview: boolean;
  review: OwnOrderItemReview | null;
}

const STATUS_LABEL: Record<OwnOrderItemReview['status'], string> = {
  PENDING: 'Pending moderation',
  APPROVED: 'Live on the product page',
  REJECTED: 'Not approved for publishing',
};

const STATUS_CLASS: Record<OwnOrderItemReview['status'], string> = {
  PENDING: 'statusPending',
  APPROVED: 'statusApproved',
  REJECTED: 'statusRejected',
};

export function WriteReviewButton({ productId, productName, orderItemId, orderId, canReview, review }: WriteReviewButtonProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openImageIndex, setOpenImageIndex] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { rating: number; title: string; body: string; keptImageUrls: string[]; newImages: File[] }) =>
      review
        ? updateReview(review.id, {
            rating: input.rating,
            title: input.title || null,
            body: input.body || null,
            keepImageUrls: input.keptImageUrls,
            images: input.newImages,
          })
        : submitReview(productId, {
            rating: input.rating,
            title: input.title || null,
            body: input.body || null,
            orderItemId,
            images: input.newImages,
          }),
    onSuccess: () => {
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : `Could not ${review ? 'update' : 'submit'} review.`),
  });

  function openModal() {
    setError(null);
    setIsOpen(true);
  }

  return (
    <>
      {review ? (
        <div className={styles.reviewCard}>
          <div className={styles.reviewCardHeader}>
            <span className={styles.stars} aria-label={`You rated this ${review.rating} out of 5 stars`}>
              {'★'.repeat(review.rating)}
              {'☆'.repeat(5 - review.rating)}
            </span>
            <span className={`${styles.statusTag} ${styles[STATUS_CLASS[review.status]]}`}>
              {STATUS_LABEL[review.status]}
            </span>
          </div>
          {review.title && <p className={styles.reviewTitle}>{review.title}</p>}
          {review.body && <p className={styles.reviewBody}>{review.body}</p>}
          {review.images.length > 0 && (
            <div className={styles.reviewImages}>
              {review.images.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  className={styles.reviewImageButton}
                  onClick={() => setOpenImageIndex(i)}
                  aria-label="View full-size photo"
                >
                  <img src={url} alt="" className={styles.reviewImageThumb} />
                </button>
              ))}
            </div>
          )}
          <button type="button" className={styles.editButton} onClick={openModal}>
            Edit Review
          </button>
        </div>
      ) : canReview ? (
        <button type="button" className={styles.writeButton} onClick={openModal}>
          Write a Review
        </button>
      ) : null}

      {isOpen && (
        <ReviewFormModal
          productName={productName}
          isEditing={!!review}
          initialRating={review?.rating ?? 5}
          initialTitle={review?.title ?? ''}
          initialBody={review?.body ?? ''}
          initialImages={review?.images ?? []}
          isSubmitting={mutation.isPending}
          error={error}
          onSubmit={(input) => mutation.mutate(input)}
          onClose={() => setIsOpen(false)}
        />
      )}
      {openImageIndex !== null && review && (
        <ImageLightbox images={review.images} startIndex={openImageIndex} onClose={() => setOpenImageIndex(null)} />
      )}
    </>
  );
}
