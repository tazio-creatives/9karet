import { listModerationQuerySchema } from '../validators/reviews.validators.js';
import * as reviewsService from '../services/reviewsService.js';

function toAdminReviewDto(row) {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status,
    isVerifiedPurchase: row.is_verified_purchase,
    reviewerName: row.full_name,
    reviewerMobile: row.mobile_number,
    productName: row.product_name,
    productSlug: row.product_slug,
    createdAt: row.created_at,
    images: row.images ?? [],
  };
}

export async function list(req, res, next) {
  try {
    const q = listModerationQuerySchema.parse(req.query);
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const { items, total } = await reviewsService.getModerationQueue({ status: q.status, page, limit });
    res.json({
      reviews: items.map(toAdminReviewDto),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function approve(req, res, next) {
  try {
    const review = await reviewsService.approveReview(req.params.id);
    res.json({ review: { id: review.id, status: review.status } });
  } catch (err) {
    next(err);
  }
}

export async function reject(req, res, next) {
  try {
    const review = await reviewsService.rejectReview(req.params.id);
    res.json({ review: { id: review.id, status: review.status } });
  } catch (err) {
    next(err);
  }
}

export async function resetToPending(req, res, next) {
  try {
    const review = await reviewsService.resetReviewToPending(req.params.id);
    res.json({ review: { id: review.id, status: review.status } });
  } catch (err) {
    next(err);
  }
}
