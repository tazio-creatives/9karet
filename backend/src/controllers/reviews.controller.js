import { createReviewSchema, updateReviewSchema, listReviewsQuerySchema } from '../validators/reviews.validators.js';
import * as reviewsService from '../services/reviewsService.js';

function toPublicReviewDto(row) {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    isVerifiedPurchase: row.is_verified_purchase,
    reviewerName: row.full_name ?? 'Anonymous',
    createdAt: row.created_at,
    images: row.images ?? [],
  };
}

export async function list(req, res, next) {
  try {
    const q = listReviewsQuerySchema.parse(req.query);
    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const { items, total } = await reviewsService.getApprovedReviews(req.params.id, { page, limit });
    res.json({
      reviews: items.map(toPublicReviewDto),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const input = createReviewSchema.parse(req.body);
    const review = await reviewsService.createReview(req.customer.id, req.params.id, input, req.files ?? []);
    res.status(201).json({ review: { id: review.id, status: review.status, images: review.images ?? [] } });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const input = updateReviewSchema.parse(req.body);
    const review = await reviewsService.updateReview(req.customer.id, req.params.id, input, req.files ?? []);
    res.json({ review: { id: review.id, status: review.status, images: review.images ?? undefined } });
  } catch (err) {
    next(err);
  }
}
