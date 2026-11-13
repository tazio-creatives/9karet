import { boss } from '../jobs/queue.js';
import { JOB_PRODUCT_SIZE_IMAGE_GENERATE } from '../jobs/productSizeImageJob.js';
import { findMeasurementsByProductId, upsertMeasurements } from '../repositories/productSizeMeasurements.repository.js';
import { findByProductId, beginGeneration, markStale } from '../repositories/productSizeGeneratedImages.repository.js';
import { findThumbnailBySortOrder } from '../repositories/productImages.repository.js';
import { validateMeasurementsInput } from '../validators/productSizeMeasurements.validators.js';
import { findProductById } from '../repositories/products.repository.js';
import { AppError, NotFoundError } from '../utils/AppError.js';

function toMeasurementsDto(row) {
  if (!row) return null;
  return {
    jewelleryType: row.jewellery_type,
    unit: row.unit,
    measurements: row.measurements,
    includedParts: row.included_parts,
    excludedParts: row.excluded_parts,
    note: row.note,
    version: row.version,
  };
}

function toGeneratedImageDto(row, imageUrl) {
  if (!row) return null;
  return {
    status: row.status,
    failureReason: row.failure_reason,
    measurementVersion: row.measurement_version,
    // Set only when a generation attempt actually finishes (see
    // markResult) — survives a later status='stale' flip, so this always
    // shows when the CURRENT image was really produced, not when the row
    // was last touched for any reason.
    generatedAt: row.generated_at,
    // A preview is only worth showing once there's an actual photo group to
    // point at — a 'generating'/'failed' row before any success has none.
    imageUrl: row.image_sort_order != null ? (imageUrl ?? null) : null,
  };
}

export async function getMeasurements(req, res, next) {
  try {
    const productId = req.params.id;
    const product = await findProductById(productId);
    if (!product) throw new NotFoundError('Product not found');

    const measurements = await findMeasurementsByProductId(productId);
    const generatedImage = await findByProductId(productId);
    const thumbnail = generatedImage?.image_sort_order != null
      ? await findThumbnailBySortOrder(productId, generatedImage.image_sort_order)
      : null;
    res.json({
      measurements: toMeasurementsDto(measurements),
      generatedImage: toGeneratedImageDto(generatedImage, thumbnail?.url),
    });
  } catch (err) {
    next(err);
  }
}

// Save-only — no generation. Immediately marks any active generated image
// stale if this save actually changed a field the render depends on (the
// version bump happens inside the repository's upsert; here we just also
// flip the display status so the admin UI reflects it without a poll).
export async function saveMeasurements(req, res, next) {
  try {
    const productId = req.params.id;
    const product = await findProductById(productId);
    if (!product) throw new NotFoundError('Product not found');

    const input = req.body ?? {};
    validateMeasurementsInput(input);

    const before = await findMeasurementsByProductId(productId);
    const saved = await upsertMeasurements(productId, input);

    if (before && before.version !== saved.version) {
      await markStale(productId);
    }

    const generatedImage = await findByProductId(productId);
    const thumbnail = generatedImage?.image_sort_order != null
      ? await findThumbnailBySortOrder(productId, generatedImage.image_sort_order)
      : null;
    res.json({
      measurements: toMeasurementsDto(saved),
      generatedImage: toGeneratedImageDto(generatedImage, thumbnail?.url),
    });
  } catch (err) {
    next(err);
  }
}

// Generate (or regenerate) the Product Size Image — works regardless of
// whether an AI Studio job is open, in review, or long completed (plan
// point 2). Saves the submitted measurements first (same validation/version/
// stale-marking as saveMeasurements above) so "Generate Size Image" from a
// blank form and "Edit Measurements -> Regenerate" both go through one path.
export async function generateImage(req, res, next) {
  try {
    const productId = req.params.id;
    const product = await findProductById(productId);
    if (!product) throw new NotFoundError('Product not found');

    const input = req.body ?? {};
    // Generation needs every value the ruler uses (e.g. a Pendant's overall
    // height) — checked before anything is saved or queued.
    validateMeasurementsInput(input, { forGeneration: true });

    const before = await findMeasurementsByProductId(productId);
    const saved = await upsertMeasurements(productId, input);
    if (before && before.version !== saved.version) {
      await markStale(productId);
    }

    const existing = await findByProductId(productId);
    if (existing && existing.status === 'generating') {
      throw new AppError(409, 'A Product Size Image is already being generated for this product.');
    }

    await beginGeneration(productId, saved.version);
    await boss.send(JOB_PRODUCT_SIZE_IMAGE_GENERATE, { productId });

    res.status(202).json({ status: 'generating' });
  } catch (err) {
    next(err);
  }
}
