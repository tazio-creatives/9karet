import { boss, createQueueSafe } from './queue.js';
import { withTransaction, query } from '../config/db.js';
import { runProductSizeGeneration } from '../services/productSizeImageService.js';
import { processAndStoreImage } from '../services/imageProcessingService.js';
import { findMeasurementsByProductId } from '../repositories/productSizeMeasurements.repository.js';
import { findByProductId, markResult } from '../repositories/productSizeGeneratedImages.repository.js';
import { deleteProductImagesBySortOrder } from '../repositories/productImages.repository.js';

export const JOB_PRODUCT_SIZE_IMAGE_GENERATE = 'product-size-image-generate';

// Decoupled from aiStudioJob.js entirely — its own small queue, its own
// worker, no dependency on ai_studio_jobs/ai_studio_assets status (plan:
// "does not require restarting the complete AI Studio workflow" — this
// handler runs identically whether triggered from inside an open wizard
// session or from a completely separate, already-published product).
async function generateHandler(jobs) {
  const [job] = jobs;
  const { productId } = job.data;

  const measurementsRow = await findMeasurementsByProductId(productId);
  if (!measurementsRow) {
    await markResult(productId, { status: 'failed', failureReason: 'No measurements are saved for this product.' });
    return;
  }

  const result = await runProductSizeGeneration(productId, measurementsRow);

  if (result.status === 'failed' || !result.buffer) {
    // The previous good image (if any) is left completely untouched — only
    // this attempt's own status/failure_reason changes (plan point 9: never
    // remove a working image before a replacement has actually succeeded).
    await markResult(productId, { status: 'failed', failureReason: result.failureReason });
    return;
  }

  // Capture what the currently-active row still points at BEFORE
  // overwriting it, so the old photo group can be deleted only after the
  // new one is safely committed.
  const before = await findByProductId(productId);
  const previousSortOrder = before?.image_sort_order ?? null;

  // Higher encoder quality than the photographic default (imageProcessingService's
  // AVIF 85 / WebP 75) — this source is thin black ruler lines and small text on
  // flat white, exactly the content those quality settings visibly blur/ring on.
  const variants = await processAndStoreImage(productId, result.buffer, { quality: { avif: 92, webp: 92 } });

  await withTransaction(async (client) => {
    const { rows: maxRows } = await client.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS max FROM product_images WHERE product_id = $1',
      [productId],
    );
    const nextSortOrder = maxRows[0].max + 1;

    for (const v of variants) {
      await client.query(
        `INSERT INTO product_images (product_id, type, variant, format, url, is_primary, sort_order)
         VALUES ($1, 'PRODUCT_SIZE', $2, $3, $4, false, $5)`,
        [productId, v.variant, v.format, v.url, nextSortOrder],
      );
    }

    await client.query(
      `UPDATE product_size_generated_images
       SET status = $2, image_sort_order = $3, measurement_version = $4, failure_reason = NULL, updated_at = now()
       WHERE product_id = $1`,
      [productId, result.status, nextSortOrder, measurementsRow.version],
    );
  });

  // Only after the new group is committed does the old one get removed —
  // never the other way around (plan point 9).
  if (previousSortOrder != null) {
    await deleteProductImagesBySortOrder(productId, previousSortOrder);
  }
}

export async function registerProductSizeImageWorker() {
  await createQueueSafe(JOB_PRODUCT_SIZE_IMAGE_GENERATE, { expireInMinutes: 20 });
  await boss.work(JOB_PRODUCT_SIZE_IMAGE_GENERATE, generateHandler);
}
