import crypto from 'node:crypto';
import { withTransaction } from '../config/db.js';
import { AppError, ForbiddenError, NotFoundError } from '../utils/AppError.js';
import { findOrderItemById, findOrderById } from '../repositories/orders.repository.js';
import { storageProvider } from '../providers/storage/index.js';
import { keyFromUrl } from '../utils/storageKey.js';
import {
  findReviewByOrderItemId,
  insertReviewTx,
  insertReviewImagesTx,
  deleteReviewImagesTx,
  findApprovedReviewsByProduct,
  findReviewsForModeration,
  findReviewById,
  findImagesByReviewIds,
  updateReviewStatusTx,
  updateReviewContentTx,
  recalculateProductRatingTx,
} from '../repositories/reviews.repository.js';

async function saveReviewImages(userId, files) {
  const saved = [];
  for (const file of files) {
    const ext = file.mimetype.split('/')[1];
    const key = `reviews/${userId}/${crypto.randomUUID()}.${ext}`;
    const { url } = await storageProvider.save(key, file.buffer);
    saved.push(url);
  }
  return saved;
}

// Best-effort — a stray orphaned file in storage isn't worth failing the
// request over, unlike the DB row it's attached to.
async function deleteStoredImages(urls) {
  await Promise.all(
    urls.map((url) =>
      storageProvider.delete(keyFromUrl(url)).catch(() => {
        /* orphaned file, not worth failing the request over */
      }),
    ),
  );
}

// plan §11a: reviews only accepted for a delivered order that actually
// belongs to the reviewer, one review per order_item (also enforced by the
// partial unique index at the DB level — this check just gives a clean 400
// instead of a raw constraint-violation 500).
export async function createReview(userId, productId, input, files = []) {
  const orderItem = await findOrderItemById(input.orderItemId);
  if (!orderItem) throw new NotFoundError('Order item not found');
  if (orderItem.product_id !== productId) {
    throw new AppError(400, 'That order item is not for this product');
  }

  const order = await findOrderById(orderItem.order_id);
  if (!order || order.user_id !== userId) throw new ForbiddenError('Not your order');
  if (order.status !== 'DELIVERED') {
    throw new AppError(400, 'You can only review items from delivered orders');
  }

  const existing = await findReviewByOrderItemId(input.orderItemId);
  if (existing) throw new AppError(400, 'You already reviewed this item');

  const imageUrls = await saveReviewImages(userId, files);

  return withTransaction(async (client) => {
    const review = await insertReviewTx(client, {
      productId,
      userId,
      orderItemId: input.orderItemId,
      rating: input.rating,
      title: input.title,
      body: input.body,
      isVerifiedPurchase: true,
    });
    await insertReviewImagesTx(client, review.id, imageUrls);
    return { ...review, images: imageUrls };
  });
}

// Editing content resets an already-approved review back to PENDING — the
// old content's rating/text is what got moderated, so changed content needs
// re-review before it counts toward the product's public rating again.
//
// Images are reconciled, not blindly replaced: the customer only ever holds
// File objects for *new* photos (browser File objects can't represent an
// already-uploaded image), so keeping an existing photo has to happen by its
// URL. `keepImageUrls` (undefined = images weren't touched at all, so leave
// them alone; an array, even empty, = the customer reviewed their photos)
// says which existing URLs survive; anything already on the review but
// missing from that list is dropped, new `files` are appended after it.
export async function updateReview(userId, reviewId, input, files = []) {
  const review = await findReviewById(reviewId);
  if (!review) throw new NotFoundError('Review not found');
  if (review.user_id !== userId) throw new ForbiddenError('Not your review');

  const wasApproved = review.status === 'APPROVED';
  const touchesImages = input.keepImageUrls !== undefined || files.length > 0;
  const newImageUrls = files.length > 0 ? await saveReviewImages(userId, files) : [];

  const result = await withTransaction(async (client) => {
    const updated = await updateReviewContentTx(client, reviewId, input);
    let finalImages = null;
    let removedImageUrls = [];
    if (touchesImages) {
      const currentImages = (await findImagesByReviewIds([reviewId])).get(reviewId) ?? [];
      const keepSet = new Set(input.keepImageUrls ?? []);
      const kept = currentImages.filter((url) => keepSet.has(url));
      removedImageUrls = currentImages.filter((url) => !keepSet.has(url));
      finalImages = [...kept, ...newImageUrls];
      await deleteReviewImagesTx(client, reviewId);
      await insertReviewImagesTx(client, reviewId, finalImages);
    }
    if (wasApproved) await recalculateProductRatingTx(client, review.product_id);
    return { updated, finalImages, removedImageUrls };
  });

  if (result.removedImageUrls.length > 0) await deleteStoredImages(result.removedImageUrls);
  return result.finalImages !== null ? { ...result.updated, images: result.finalImages } : result.updated;
}

export function getApprovedReviews(productId, pagination) {
  return findApprovedReviewsByProduct(productId, pagination);
}

export function getModerationQueue(filters) {
  return findReviewsForModeration(filters);
}

export async function approveReview(id) {
  const review = await findReviewById(id);
  if (!review) throw new NotFoundError('Review not found');
  if (review.status === 'APPROVED') return review;

  return withTransaction(async (client) => {
    const updated = await updateReviewStatusTx(client, id, 'APPROVED');
    await recalculateProductRatingTx(client, review.product_id);
    return updated;
  });
}

export async function rejectReview(id) {
  const review = await findReviewById(id);
  if (!review) throw new NotFoundError('Review not found');
  if (review.status === 'REJECTED') return review;

  return withTransaction(async (client) => {
    const updated = await updateReviewStatusTx(client, id, 'REJECTED');
    // Only needs a recalc if it was previously counted (APPROVED -> REJECTED
    // reverses a moderation decision); PENDING -> REJECTED never affected
    // the aggregate in the first place.
    if (review.status === 'APPROVED') await recalculateProductRatingTx(client, review.product_id);
    return updated;
  });
}

// Lets an admin undo a moderation decision (Approved or Rejected) and send
// the review back through the queue for re-review.
export async function resetReviewToPending(id) {
  const review = await findReviewById(id);
  if (!review) throw new NotFoundError('Review not found');
  if (review.status === 'PENDING') return review;

  return withTransaction(async (client) => {
    const updated = await updateReviewStatusTx(client, id, 'PENDING');
    // Pulling an APPROVED review back to PENDING removes it from the public
    // aggregate until it's re-approved.
    if (review.status === 'APPROVED') await recalculateProductRatingTx(client, review.product_id);
    return updated;
  });
}
