import { AppError, NotFoundError } from '../utils/AppError.js';
import { keyFromUrl } from '../utils/storageKey.js';
import { storageProvider } from '../providers/storage/index.js';
import { processAndStoreImage } from '../services/imageProcessingService.js';
import { boss } from '../jobs/queue.js';
import { JOB_AI_IMAGE_GENERATE } from '../jobs/aiImageJob.js';
import {
  findLatestAiImageJobByProduct,
  findGeneratedImagesByJobId,
  findGeneratedImageById,
  markGeneratedImageApproved,
  deleteGeneratedImage,
  deleteUnapprovedGeneratedImagesByJobId,
  insertAiImageJob,
} from '../repositories/aiImages.repository.js';
import { findProductImages, findProductById, updateProduct } from '../repositories/products.repository.js';
import {
  countProductImages,
  insertProductImage,
  clearPrimaryForProduct,
  setPrimaryBySortOrder,
  findMaxSortOrder,
} from '../repositories/productImages.repository.js';

function toJobDto(job, images) {
  return {
    id: job.id,
    status: job.status,
    error: job.error,
    candidates: images.map((img) => ({
      id: img.id,
      imageUrl: img.image_url,
      approved: img.approved,
      metadata: img.metadata,
    })),
  };
}

export async function getStatus(req, res, next) {
  try {
    const job = await findLatestAiImageJobByProduct(req.params.id);
    if (!job) return res.json({ job: null });
    const images = await findGeneratedImagesByJobId(job.id);
    res.json({ job: toJobDto(job, images) });
  } catch (err) {
    next(err);
  }
}

// Promotes one AI candidate into the real product gallery — runs it through
// the same variant-derivation pipeline as an uploaded original (plan §10:
// "chooses primary → reorders gallery → product.status = PUBLISHED" implies
// the approved image becomes a first-class product_images entry, not just a
// flagged candidate row).
export async function approve(req, res, next) {
  try {
    const productId = req.params.id;
    const candidate = await findGeneratedImageById(req.params.imageId);
    if (!candidate) throw new NotFoundError('Generated image not found');

    const sourceBuffer = await storageProvider.read(keyFromUrl(candidate.image_url));
    const variants = await processAndStoreImage(productId, sourceBuffer);
    const [aiCount, originalCount] = await Promise.all([
      countProductImages(productId, 'AI_GENERATED'),
      countProductImages(productId, 'ORIGINAL'),
    ]);
    const isFirstImage = aiCount === 0 && originalCount === 0;
    const sortOrder = (await findMaxSortOrder(productId)) + 1;

    for (const v of variants) {
      await insertProductImage({
        productId,
        type: 'AI_GENERATED',
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

    await markGeneratedImageApproved(candidate.id);

    const rows = await findProductImages(productId);
    res.json({ images: rows });
  } catch (err) {
    next(err);
  }
}

export async function reject(req, res, next) {
  try {
    const candidate = await findGeneratedImageById(req.params.imageId);
    if (!candidate) throw new NotFoundError('Generated image not found');
    if (candidate.approved) throw new AppError(400, 'Cannot reject an already-approved image');

    await deleteGeneratedImage(candidate.id);
    await storageProvider.delete(keyFromUrl(candidate.image_url)).catch(() => {});
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Re-runs the whole 4-candidate batch (plan §10 "regenerate") — discards
// unapproved candidates from the previous job, leaves anything already
// promoted to product_images untouched.
export async function regenerate(req, res, next) {
  try {
    const productId = req.params.id;
    const product = await findProductById(productId);
    if (!product) throw new NotFoundError('Product not found');

    const images = await findProductImages(productId);
    const originalRow = images.find((img) => img.type === 'ORIGINAL' && img.variant === 'original');
    if (!originalRow) {
      throw new AppError(400, 'Upload an original photo before requesting AI variants');
    }

    const previousJob = await findLatestAiImageJobByProduct(productId);
    if (previousJob) await deleteUnapprovedGeneratedImagesByJobId(previousJob.id);

    const job = await insertAiImageJob({ productId, provider: 'stub' });
    // A PUBLISHED product stays PUBLISHED while regenerating more variants —
    // see aiImageJob.js for why (same lifecycle-tracking guard).
    if (product.status !== 'PUBLISHED') {
      await updateProduct(productId, { status: 'AI_PROCESSING' });
    }
    await boss.send(JOB_AI_IMAGE_GENERATE, {
      jobId: job.id,
      productId,
      originalKey: keyFromUrl(originalRow.url),
    });

    res.status(202).json({ aiImageJobId: job.id });
  } catch (err) {
    next(err);
  }
}
