import crypto from 'node:crypto';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { withTransaction } from '../config/db.js';
import { createReturnRequestSchema } from '../validators/orders.validators.js';
import {
  findOrderById,
  findOrderItems,
  findOrderStatusHistory,
  updateOrderStatusFieldsTx,
  insertOrderStatusHistoryTx,
} from '../repositories/orders.repository.js';
import {
  findReturnRequestByOrderId,
  hasActiveReturnRequest,
  insertReturnRequest,
  cancelReturnRequestTx,
} from '../repositories/returnRequests.repository.js';
import { storageProvider } from '../providers/storage/index.js';
import { findNonReturnableProductIds } from '../repositories/products.repository.js';
import { RETURN_WINDOW_DAYS } from '../utils/orderStatus.js';

// Return & Refund Policy: live photographs are required alongside the video.
const MIN_RETURN_PHOTOS = 3;
const MAX_RETURN_PHOTOS = 8;
// Reasons allowed for a non-returnable product (custom, engraved…) — the
// policy only excludes change-of-mind returns, never a faulty/wrong item.
const PROBLEM_REASONS = ['DAMAGED', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED'];

// Normalised to a reasonably sized JPEG — phone photos are often 5–10 MB
// and carry EXIF rotation that browsers in admin may not honour.
async function saveReturnPhoto(orderId, file) {
  let buffer;
  try {
    buffer = await sharp(file.buffer).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  } catch {
    throw new AppError(400, 'One of the photos could not be read. Please upload JPG or PNG photos.');
  }
  const saved = await storageProvider.save(`returns/${orderId}/photos/${crypto.randomUUID()}.jpg`, buffer);
  return saved.url;
}
import { NotFoundError, AppError } from '../utils/AppError.js';
import { enqueueEmail } from '../services/emailService.js';

async function loadOwnedOrder(req) {
  const order = await findOrderById(req.params.id);
  if (!order || order.user_id !== req.customer.id) throw new NotFoundError('Order not found');
  return order;
}

function toReturnRequestDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    reason: row.reason,
    note: row.note,
    videoUrl: row.video_url,
    photoUrls: row.photo_urls ?? [],
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function get(req, res, next) {
  try {
    const order = await loadOwnedOrder(req);
    const returnRequest = await findReturnRequestByOrderId(order.id);
    res.json({ returnRequest: toReturnRequestDto(returnRequest) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const order = await loadOwnedOrder(req);
    const { reason, note } = createReturnRequestSchema.parse(req.body);

    if (order.order_status !== 'DELIVERED') {
      throw new AppError(400, 'Only a delivered order can be returned');
    }

    const history = await findOrderStatusHistory(order.id);
    const deliveredAt = history.find((h) => h.status === 'DELIVERED')?.created_at;
    const deadline = deliveredAt ? new Date(deliveredAt).getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000 : 0;
    if (!deliveredAt || Date.now() > deadline) {
      throw new AppError(400, `Return requests must be submitted within ${RETURN_WINDOW_DAYS} days of delivery`);
    }

    if (await hasActiveReturnRequest(order.id)) {
      throw new AppError(400, 'A return request is already in progress for this order');
    }

    // Change-of-mind returns aren't accepted for non-returnable products
    // (product or category flag) — only a genuine problem with the item.
    const items = await findOrderItems(order.id);
    const nonReturnable = await findNonReturnableProductIds(items.map((i) => i.product_id).filter(Boolean));
    if (nonReturnable.length > 0 && !PROBLEM_REASONS.includes(reason)) {
      throw new AppError(
        400,
        'This order contains a non-returnable item (e.g. custom or engraved jewellery), so it can only be returned if it arrived damaged, defective, incorrect or not as described.',
      );
    }

    const videoFile = req.files?.video?.[0] ?? null;
    const photoFiles = req.files?.photos ?? [];

    // Return and Refund Policy: a continuous unboxing video is mandatory for
    // every return request — enforced here, not only in the form.
    if (!videoFile) {
      throw new AppError(400, 'An unboxing video is required to request a return. Please upload your complete unboxing video.');
    }

    if (photoFiles.length < MIN_RETURN_PHOTOS) {
      throw new AppError(
        400,
        `Please add at least ${MIN_RETURN_PHOTOS} clear photos — the jewellery, its certificate, and the packaging/tag.`,
      );
    }
    if (photoFiles.length > MAX_RETURN_PHOTOS) {
      throw new AppError(400, `You can add up to ${MAX_RETURN_PHOTOS} photos.`);
    }
    if (photoFiles.some((f) => f.size > env.maxUploadSizeMb * 1024 * 1024)) {
      throw new AppError(400, `Each photo must be under ${env.maxUploadSizeMb} MB.`);
    }

    const ext = videoFile.mimetype === 'video/quicktime' ? 'mov' : videoFile.mimetype.split('/')[1];
    const savedVideo = await storageProvider.save(`returns/${order.id}/${crypto.randomUUID()}.${ext}`, videoFile.buffer);
    const videoUrl = savedVideo.url;
    const photoUrls = [];
    for (const file of photoFiles) photoUrls.push(await saveReturnPhoto(order.id, file));

    const returnRequest = await withTransaction(async (client) => {
      const inserted = await insertReturnRequest(order.id, { reason, note, videoUrl, photoUrls });
      await updateOrderStatusFieldsTx(client, order.id, { orderStatus: 'RETURN_INITIATED' });
      await insertOrderStatusHistoryTx(
        client,
        order.id,
        'RETURN_INITIATED',
        `Return requested by customer (${reason})`,
        { source: 'CUSTOMER' },
      );
      return inserted;
    });

    await enqueueEmail(order.contact_email, 'RETURN_REQUEST_RECEIVED', {
      orderId: order.id,
      contactName: order.contact_name,
      orderNumber: order.order_number,
    });

    res.status(201).json({ returnRequest: toReturnRequestDto(returnRequest) });
  } catch (err) {
    next(err);
  }
}

// Only while still REQUESTED — once an admin has approved/rejected it,
// that decision stands; the customer can't un-do a moderation outcome
// through this endpoint.
export async function cancel(req, res, next) {
  try {
    const order = await loadOwnedOrder(req);
    const returnRequest = await findReturnRequestByOrderId(order.id);
    if (!returnRequest || returnRequest.status !== 'REQUESTED') {
      throw new AppError(400, 'This return request can no longer be cancelled');
    }

    const updated = await withTransaction(async (client) => {
      const cancelled = await cancelReturnRequestTx(client, returnRequest.id);
      await updateOrderStatusFieldsTx(client, order.id, { orderStatus: 'DELIVERED' });
      await insertOrderStatusHistoryTx(client, order.id, 'DELIVERED', 'Return request cancelled by customer', {
        source: 'CUSTOMER',
      });
      return cancelled;
    });

    res.json({ returnRequest: toReturnRequestDto(updated) });
  } catch (err) {
    next(err);
  }
}
