import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchReviews } from '../../api/reviews';
import { Pagination } from '../../components/Pagination';
import { ImageLightbox } from '../../components/ImageLightbox';
import type { Review } from '../../api/types';
import styles from './ReviewsSection.module.css';

// Longer than this and a card would grow to dominate the row — truncate and
// let "Read more" reveal the rest in place instead.
const TRUNCATE_AT = 160;

function Stars({ rating }: { rating: number }) {
  return (
    <span className={styles.stars} aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  );
}

function ReviewCard({ review, expanded, onToggleExpand }: { review: Review; expanded: boolean; onToggleExpand: () => void }) {
  const body = review.body ?? '';
  const isLong = body.length > TRUNCATE_AT;
  const shownBody = expanded || !isLong ? body : `${body.slice(0, TRUNCATE_AT).trimEnd()}…`;
  const [openImageIndex, setOpenImageIndex] = useState<number | null>(null);

  return (
    <li className={styles.card}>
      <div className={styles.reviewHeader}>
        <Stars rating={review.rating} />
        {review.isVerifiedPurchase && <span className={styles.verifiedBadge}>Verified Purchase</span>}
      </div>
      {review.title && <p className={styles.reviewTitle}>{review.title}</p>}
      {body && (
        <p className={styles.reviewBody}>
          {shownBody}{' '}
          {isLong && (
            <button type="button" className={styles.readMore} onClick={onToggleExpand}>
              {expanded ? 'Read less' : 'Read more'}
            </button>
          )}
        </p>
      )}
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
      <p className={styles.reviewMeta}>
        {review.reviewerName} · {new Date(review.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
      </p>
      {openImageIndex !== null && (
        <ImageLightbox images={review.images} startIndex={openImageIndex} onClose={() => setOpenImageIndex(null)} />
      )}
    </li>
  );
}

export function ReviewsSection({ productId }: { productId: string }) {
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { data, isLoading } = useQuery({
    queryKey: ['reviews', productId, page],
    queryFn: () => fetchReviews(productId, page),
  });

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return (
      <ul className={styles.scroller} aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className={styles.card}>
            <div className={styles.skeletonLine} style={{ width: 100, marginBottom: 10 }} />
            <div className={styles.skeletonLine} style={{ width: '90%', marginBottom: 6 }} />
            <div className={styles.skeletonLine} style={{ width: '70%', marginBottom: 10 }} />
            <div className={styles.skeletonLine} style={{ width: 140 }} />
          </li>
        ))}
      </ul>
    );
  }
  if (!data || data.reviews.length === 0) {
    return <p className={styles.empty}>No reviews yet — be the first to review this piece.</p>;
  }

  return (
    <div>
      <ul className={styles.scroller}>
        {data.reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            expanded={expandedIds.has(review.id)}
            onToggleExpand={() => toggleExpand(review.id)}
          />
        ))}
      </ul>
      <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
    </div>
  );
}
