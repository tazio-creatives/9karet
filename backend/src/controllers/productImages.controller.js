import { reorderImagesSchema, attachExistingImageSchema } from '../validators/productImages.validators.js';
import { processAndStoreImage } from '../services/imageProcessingService.js';
import { storageProvider } from '../providers/storage/index.js';
import { keyFromUrl } from '../utils/storageKey.js';
import { AppError, NotFoundError } from '../utils/AppError.js';
import { findProductById, findProductImages } from '../repositories/products.repository.js';
import {
  countProductImages,
  insertProductImage,
  clearPrimaryForProduct,
  setPrimaryBySortOrder,
  updateSortOrder,
  deleteProductImagesBySortOrder,
  findMaxSortOrder,
  findAllImageGroups,
  findProductImageSiblings,
} from '../repositories/productImages.repository.js';
function groupImages(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.sort_order)) {
      groups.set(row.sort_order, {
        sortOrder: row.sort_order,
        type: row.type,
        isPrimary: row.is_primary,
        variants: [],
      });
    }
    groups.get(row.sort_order).variants.push({ variant: row.variant, format: row.format, url: row.url });
  }
  return [...groups.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function list(req, res, next) {
  try {
    const rows = await findProductImages(req.params.id);
    res.json({ images: groupImages(rows) });
  } catch (err) {
    next(err);
  }
}

// Admin uploads a photo directly — this is a plain manual upload, entirely
// independent of the "Generate with AI" flow (that's a separate, explicit
// action via the AI Image Studio). Manual uploads never trigger AI
// generation on their own.
export async function uploadOriginal(req, res, next) {
  try {
    if (!req.file) throw new AppError(400, 'No image file provided');

    const productId = req.params.id;
    const product = await findProductById(productId);
    if (!product) throw new NotFoundError('Product not found');

    const variants = await processAndStoreImage(productId, req.file.buffer);
    const isFirstImage = (await countProductImages(productId, 'ORIGINAL')) === 0;
    const sortOrder = (await findMaxSortOrder(productId)) + 1;

    for (const v of variants) {
      await insertProductImage({
        productId,
        type: 'ORIGINAL',
        variant: v.variant,
        format: v.format,
        url: v.url,
        sortOrder,
      });
    }
    if (isFirstImage) {
      await clearPrimaryForProduct(productId);
      await setPrimaryBySortOrder(productId, sortOrder);
    }

    const rows = await findProductImages(productId);
    res.status(201).json({ images: groupImages(rows) });
  } catch (err) {
    next(err);
  }
}

// Gallery-wide picker (plan: "show gallery all images when product upload,
// if the image already exists we can select it") — lists one thumbnail per
// image group across every product so the admin can reuse an existing photo
// instead of re-uploading the same shot for a second listing.
export async function listAllImages(req, res, next) {
  try {
    const { search, excludeProductId, limit, offset } = req.query;
    const rows = await findAllImageGroups({
      search: search || null,
      excludeProductId: excludeProductId || null,
      limit: limit ? Math.min(Number(limit), 100) : 60,
      offset: offset ? Number(offset) : 0,
    });
    res.json({
      images: rows.map((r) => ({
        productId: r.product_id,
        productName: r.product_name,
        sortOrder: r.sort_order,
        thumbnailUrl: r.thumb_url,
        isPrimary: r.is_primary,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// Attaches an existing image (all its variants) to this product by copying
// the product_images rows onto a new sort_order — the underlying files are
// reused as-is (same URLs), nothing is re-uploaded or re-processed.
export async function attachExisting(req, res, next) {
  try {
    const productId = req.params.id;
    const product = await findProductById(productId);
    if (!product) throw new NotFoundError('Product not found');

    const { sourceProductId, sourceSortOrder } = attachExistingImageSchema.parse(req.body);
    const siblings = await findProductImageSiblings(sourceProductId, sourceSortOrder);
    if (siblings.length === 0) throw new AppError(404, 'Source image not found');

    const isFirstImage = (await countProductImages(productId, 'ORIGINAL')) === 0;
    const sortOrder = (await findMaxSortOrder(productId)) + 1;

    for (const s of siblings) {
      await insertProductImage({
        productId,
        type: s.type,
        variant: s.variant,
        format: s.format,
        url: s.url,
        sortOrder,
      });
    }
    if (isFirstImage) {
      await clearPrimaryForProduct(productId);
      await setPrimaryBySortOrder(productId, sortOrder);
    }

    const rows = await findProductImages(productId);
    res.status(201).json({ images: groupImages(rows) });
  } catch (err) {
    next(err);
  }
}

export async function setPrimary(req, res, next) {
  try {
    const productId = req.params.id;
    const sortOrder = Number(req.params.sortOrder);
    await clearPrimaryForProduct(productId);
    await setPrimaryBySortOrder(productId, sortOrder);
    const rows = await findProductImages(productId);
    res.json({ images: groupImages(rows) });
  } catch (err) {
    next(err);
  }
}

// Two-phase remap through a temporary offset range — sort_order has no
// uniqueness constraint, but a naive single-pass remap can still transiently
// collide two groups onto the same value and clobber one of them if the
// requested permutation isn't already sorted.
export async function reorder(req, res, next) {
  try {
    const productId = req.params.id;
    const { order } = reorderImagesSchema.parse(req.body);

    for (let i = 0; i < order.length; i++) {
      await updateSortOrder(productId, order[i], -1000 - i);
    }
    for (let i = 0; i < order.length; i++) {
      await updateSortOrder(productId, -1000 - i, i);
    }

    const rows = await findProductImages(productId);
    res.json({ images: groupImages(rows) });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const productId = req.params.id;
    const sortOrder = Number(req.params.sortOrder);
    const deleted = await deleteProductImagesBySortOrder(productId, sortOrder);
    // Best-effort — a missing file on disk shouldn't block the DB cleanup
    // the admin actually asked for.
    await Promise.allSettled(
      deleted.map((row) => {
        return storageProvider.delete(keyFromUrl(row.url));
      }),
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
