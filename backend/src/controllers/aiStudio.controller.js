import crypto from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { AppError, NotFoundError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { boss } from '../jobs/queue.js';
import { JOB_AI_STUDIO_ANALYSE, JOB_AI_STUDIO_GENERATE, resetAssetForRetry } from '../jobs/aiStudioJob.js';
import {
  effectiveGenerateRoseGold,
  JEWELLERY_TYPES,
  ASSET_DISPLAY_ORDER,
  previewPromptsForJob,
  CUSTOMER_CATEGORIES,
  DEFAULT_CUSTOMER_CATEGORY,
} from '../services/aiStudioService.js';
import { findPresenterById } from '../repositories/presenters.repository.js';
import { findCategoryById } from '../repositories/categories.repository.js';
import { storageProvider } from '../providers/storage/index.js';
import { processAndStoreImage } from '../services/imageProcessingService.js';
import { withTransaction } from '../config/db.js';
import { findProductById, findProductImages } from '../repositories/products.repository.js';
import { keyFromUrl } from '../utils/storageKey.js';
import {
  findActiveJobByProduct,
  findLatestJobWithPendingAssets,
  insertJob,
  findJobById,
  lockJobById,
  updateJob,
  updateJobTx,
  findCategoryTemplate,
  insertAssets,
  findAssetsByJobId,
  findAssetsByJobIdTx,
  findAssetById,
  lockAssetByIdTx,
  updateAsset,
  updateAssetTx,
  clearFeaturedForJobTx,
  findMaxSortOrderTx,
  clearPrimaryForProductTx,
  insertProductImageTx,
} from '../repositories/aiStudio.repository.js';

const MIN_DIMENSION_PX = 200;
const MAX_DIMENSION_PX = 8000;
const CATALOGUE_ASSET_TYPES = [
  'YELLOW_FRONT',
  'YELLOW_HERO_45',
  'ROSE_FRONT',
  'ROSE_HERO_45',
  'RING_GOLD_FRONT',
  'RING_GOLD_SIDE',
  'RING_ROSE_FRONT',
  'RING_ROSE_SIDE',
];

// The only fields a "Customise Prompt" admin can edit (Review Prompts panel)
// — everything else (category, design preservation, metal colour, no
// additional jewellery, category placement, output dims, safety rules)
// stays locked/computed, never accepted from the client.
const creativeOverrideSchema = z.object({
  background: z.string().max(500).optional(),
  lighting: z.string().max(500).optional(),
  composition: z.string().max(500).optional(),
  presenterPose: z.string().max(500).optional(),
  cameraAngle: z.string().max(500).optional(),
  additionalInstructions: z.string().max(500).optional(),
});
const promptOverridesSchema = z.record(z.string(), creativeOverrideSchema);

export const confirmSchema = z.object({
  jewelleryType: z.enum(JEWELLERY_TYPES.filter((t) => t !== 'UNKNOWN')),
  categoryId: z.string().uuid().nullable().optional(),
  presenterId: z.string().uuid().nullable().optional(),
  generateRoseGold: z.boolean().optional(),
  promptOverrides: promptOverridesSchema.optional(),
  // Optional, defaults to 'WOMEN' (today's only presenter styling) — an
  // admin who never sees/uses the new Customer Category control gets
  // exactly the same generation as before this feature existed.
  customerCategory: z.enum(CUSTOMER_CATEGORIES).optional(),
});

const promptPreviewSchema = z.object({
  jewelleryType: z.enum(JEWELLERY_TYPES.filter((t) => t !== 'UNKNOWN')).optional(),
  presenterId: z.string().uuid().nullable().optional(),
  generateRoseGold: z.boolean().optional(),
  promptOverrides: promptOverridesSchema.optional(),
  customerCategory: z.enum(CUSTOMER_CATEGORIES).optional(),
});

const selectionSchema = z.object({
  selected: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  validationAccepted: z.boolean().optional(),
  customCreativeInstructions: creativeOverrideSchema.optional(),
});

// API responses never include raw storage keys or other generation
// internals — only public URLs and safe status fields. Prompt text/mode and
// the validation result ARE included (unlike the original plan §11 default)
// since the Review Prompts and Review & Import screens need to show the
// admin exactly what was/will be sent and why an image was flagged.
function assetDto(asset) {
  return {
    id: asset.id,
    assetType: asset.asset_type,
    displayOrder: asset.display_order,
    status: asset.status,
    imageUrl: asset.image_key ? storageProvider.urlFor(asset.image_key) : null,
    qualityAssessment: asset.quality_assessment,
    promptMode: asset.prompt_mode,
    customCreativeInstructions: asset.custom_creative_instructions,
    assembledFinalPrompt: asset.assembled_final_prompt,
    validationStatus: asset.validation_status,
    validationResult: asset.validation_result,
    validationAccepted: asset.validation_accepted,
    selected: asset.selected,
    isFeatured: asset.is_featured,
    imported: asset.imported,
    retryCount: asset.retry_count,
    generationStartedAt: asset.generation_started_at,
    generationCompletedAt: asset.generation_completed_at,
    error: asset.error,
  };
}

function jobDto(job, assets, presenter) {
  return {
    id: job.id,
    productId: job.product_id,
    status: job.status,
    referenceImageUrls: job.reference_image_urls,
    analysis: job.analysis,
    analysisConfidence: job.analysis_confidence == null ? null : Number(job.analysis_confidence),
    categoryConfidenceThreshold: env.aiStudioCategoryConfidenceThreshold,
    existingProductCategory: job.existing_product_category,
    aiDetectedCategory: job.ai_detected_category,
    jewelleryType: job.jewellery_type,
    categoryId: job.category_id,
    customerCategory: job.customer_category,
    aiDetectedCustomerCategory: job.ai_detected_customer_category,
    customerCategoryConfirmedAt: job.customer_category_confirmed_at,
    presenterId: job.presenter_id,
    presenter: presenter
      ? { id: presenter.id, displayName: presenter.display_name, styleLabel: presenter.style_label }
      : null,
    generateRoseGold: job.generate_rose_gold,
    error: job.error,
    createdAt: job.created_at,
    confirmedAt: job.confirmed_at,
    categoryConfirmedAt: job.category_confirmed_at,
    completedAt: job.completed_at,
    generationVersion: job.generation_version,
    assets: assets.map(assetDto),
  };
}

async function validateImageFile(file) {
  let metadata;
  try {
    metadata = await sharp(file.buffer).metadata();
  } catch {
    throw new AppError(400, `"${file.originalname}" is not a valid image file`);
  }
  if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
    throw new AppError(400, `"${file.originalname}" is not a supported image format`);
  }
  if (metadata.width < MIN_DIMENSION_PX || metadata.height < MIN_DIMENSION_PX) {
    throw new AppError(400, `"${file.originalname}" is too small — minimum ${MIN_DIMENSION_PX}px per side`);
  }
  if (metadata.width > MAX_DIMENSION_PX || metadata.height > MAX_DIMENSION_PX) {
    throw new AppError(400, `"${file.originalname}" is too large — maximum ${MAX_DIMENSION_PX}px per side`);
  }
}

// Upload 1 primary + up to 3 supporting reference photos (4 total), create
// the job, kick off analysis. Rejects with 409 (returning the existing job
// id) if one is already active for this product — enforced here and by the
// partial unique index, so a double-click race still fails cleanly rather
// than 500ing (plan §8). The first file in the array is always the primary
// image (UploadStep.tsx puts it first).
export async function createJob(req, res, next) {
  try {
    const productId = req.params.id;
    const product = await findProductById(productId);
    if (!product) throw new NotFoundError('Product not found');

    // Snapshotted once at job creation — the source of truth Analyse &
    // Confirm compares the AI's detected type against (Problem 1). Read at
    // creation, not on every subsequent request, so a category edit made to
    // the product mid-job doesn't retroactively change what this job's
    // confirmation screen is comparing against.
    let existingProductCategory = null;
    if (product.category_id) {
      const category = await findCategoryById(product.category_id);
      existingProductCategory = category?.name ?? null;
    }

    const files = req.files ?? [];
    if (files.length === 0) throw new AppError(400, 'A primary reference image is required');
    if (files.length > 4) throw new AppError(400, 'At most 1 primary + 3 supporting images are allowed');

    const existing = await findActiveJobByProduct(productId);
    if (existing) {
      return res.status(409).json({ error: { message: 'A job is already active for this product' }, jobId: existing.id });
    }

    for (const file of files) await validateImageFile(file);

    // Metadata stripped by the sharp re-encode; random key, no client-derived filename.
    const referenceImageUrls = [];
    for (const file of files) {
      const normalized = await sharp(file.buffer).jpeg({ quality: 92 }).toBuffer();
      const saved = await storageProvider.save(
        `products/ai-studio/${productId}/references/${crypto.randomUUID()}.jpeg`,
        normalized,
      );
      referenceImageUrls.push(saved.url);
    }

    let job;
    try {
      job = await insertJob({
        productId,
        referenceImageUrls,
        analysisModel: env.openaiVisionModel ?? null,
        imageModel: env.openaiImageModel,
        existingProductCategory,
      });
    } catch (err) {
      // Unique-violation race from the partial index (plan §8) — another
      // request created a job between our check above and this insert.
      if (err.code === '23505') {
        const active = await findActiveJobByProduct(productId);
        return res.status(409).json({ error: { message: 'A job is already active for this product' }, jobId: active?.id });
      }
      throw err;
    }

    await boss.send(JOB_AI_STUDIO_ANALYSE, {
      jobId: job.id,
      referenceKey: keyFromUrl(referenceImageUrls[0]),
      mimetype: 'image/jpeg',
    });

    res.status(202).json({ jobId: job.id });
  } catch (err) {
    next(err);
  }
}

// Lets the Studio page resume an in-progress job for a product instead of
// always starting at Upload — powers "Save as Draft" actually being
// resumable (the job just stays in whatever status it was left in).
export async function getActiveJob(req, res, next) {
  try {
    const job = await findActiveJobByProduct(req.params.id);
    res.json({ jobId: job?.id ?? null });
  } catch (err) {
    next(err);
  }
}

// Powers the "N AI images not imported" banner on the product edit page —
// unlike getActiveJob, this looks past the job that's currently in progress
// and finds one that finished generating but still has a READY asset that
// never made it into product_images (most often because AI Studio's
// validation flagged it and the admin navigated away before accepting it).
export async function getPendingReview(req, res, next) {
  try {
    const job = await findLatestJobWithPendingAssets(req.params.id);
    if (!job) return res.json({ job: null });
    const assets = await findAssetsByJobId(job.id);
    const pending = assets.filter((a) => a.status === 'READY' && !a.imported);
    res.json({
      job: {
        id: job.id,
        status: job.status,
        pendingCount: pending.length,
        needsReview: pending.some(
          (a) => a.validation_status && a.validation_status !== 'passed' && !a.validation_accepted,
        ),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getJob(req, res, next) {
  try {
    const job = await findJobById(req.params.jobId);
    if (!job || job.product_id !== req.params.id) throw new NotFoundError('Job not found');
    const assets = await findAssetsByJobId(job.id);
    const presenter = job.presenter_id ? await findPresenterById(job.presenter_id) : null;
    res.json({ job: jobDto(job, assets, presenter) });
  } catch (err) {
    next(err);
  }
}

// Category + (optional) presenter must be explicitly supplied here — even
// when analysis was confident, the admin's choice is what's used, never a
// silent fallback to the AI's guess (plan §5). jewelleryType excludes
// 'UNKNOWN' at the schema level, so an unresolved analysis can never reach
// generation without a real category being picked first. presenterId is
// nullable ("No Presenter" is a valid, explicit choice, not an omission).
export async function confirmJob(req, res, next) {
  try {
    const job = await findJobById(req.params.jobId);
    if (!job || job.product_id !== req.params.id) throw new NotFoundError('Job not found');
    if (job.status !== 'awaiting_confirmation') {
      throw new AppError(409, `Job is not awaiting confirmation (status: ${job.status})`);
    }

    const input = confirmSchema.parse(req.body);
    const template = await findCategoryTemplate(input.jewelleryType);
    if (!template) throw new AppError(400, `No generation template for "${input.jewelleryType}"`);

    // Rings never use a Presenter — a "Hand Pose" choice replaces it — so
    // presenterId is ignored outright for a Ring job even if the client sent
    // one (e.g. left over from switching jewellery type mid-wizard).
    const isRing = input.jewelleryType === 'RING';

    let presenter = null;
    if (!isRing && input.presenterId) {
      presenter = await findPresenterById(input.presenterId);
      if (!presenter || !presenter.is_active) throw new AppError(400, 'Selected presenter is not available');
      if (!presenter.supported_jewellery_types.includes(input.jewelleryType)) {
        throw new AppError(400, 'Selected presenter does not support this jewellery type');
      }
    }

    const generateRoseGold = effectiveGenerateRoseGold(input.jewelleryType, input.generateRoseGold ?? true);
    const customerCategory = input.customerCategory ?? DEFAULT_CUSTOMER_CATEGORY;

    await updateJob(job.id, {
      jewellery_type: input.jewelleryType,
      category_id: input.categoryId ?? null,
      presenter_id: isRing ? null : (input.presenterId ?? null),
      generate_rose_gold: generateRoseGold,
      customer_category: customerCategory,
      customer_category_confirmed_at: new Date(),
      confirmed_at: new Date(),
      category_confirmed_at: new Date(),
      status: 'generating',
    });

    // Computed once here and persisted onto each asset row (not recomputed
    // at generation time) so what the admin reviewed on the Review Prompts
    // panel is exactly what gets sent — see aiStudioJob.js's generateOneAsset,
    // which uses asset.assembled_final_prompt as-is.
    const previews = previewPromptsForJob({
      confirmedType: input.jewelleryType,
      template,
      presenter,
      generateRoseGold,
      overridesByAssetType: input.promptOverrides,
      confirmedCustomerCategory: customerCategory,
    });

    const insertedAssets = await insertAssets(
      job.id,
      previews.map((p) => ({ assetType: p.assetType, displayOrder: ASSET_DISPLAY_ORDER[p.assetType] })),
    );
    await Promise.all(
      insertedAssets.map((asset) => {
        const preview = previews.find((p) => p.assetType === asset.asset_type);
        const override = input.promptOverrides?.[asset.asset_type];
        return updateAsset(asset.id, {
          prompt_mode: preview.mode,
          custom_creative_instructions: override ? JSON.stringify(override) : null,
          assembled_final_prompt: preview.finalPrompt,
        });
      }),
    );

    await boss.send(JOB_AI_STUDIO_GENERATE, { jobId: job.id });

    res.status(202).json({ jobId: job.id });
  } catch (err) {
    next(err);
  }
}

// Computes every planned asset's prompt without starting a job or writing
// anything — lets the Review Prompts panel show (and let the admin tweak)
// the exact prompt before Confirm & Generate is clicked. jewelleryType/
// presenterId/generateRoseGold default to whatever the job already has (the
// admin may not have changed them since Analyse & Confirm / Choose Presenter).
export async function previewPrompts(req, res, next) {
  try {
    const job = await findJobById(req.params.jobId);
    if (!job || job.product_id !== req.params.id) throw new NotFoundError('Job not found');

    const input = promptPreviewSchema.parse(req.body);
    const jewelleryType = input.jewelleryType ?? job.jewellery_type;
    if (!jewelleryType) throw new AppError(400, 'jewelleryType is required');

    const template = await findCategoryTemplate(jewelleryType);
    if (!template) throw new AppError(400, `No generation template for "${jewelleryType}"`);

    const isRing = jewelleryType === 'RING';
    const presenterId = input.presenterId !== undefined ? input.presenterId : job.presenter_id;
    let presenter = null;
    if (!isRing && presenterId) {
      presenter = await findPresenterById(presenterId);
      if (!presenter || !presenter.is_active) throw new AppError(400, 'Selected presenter is not available');
    }

    const generateRoseGold = effectiveGenerateRoseGold(
      jewelleryType,
      input.generateRoseGold ?? job.generate_rose_gold ?? true,
    );
    const customerCategory = input.customerCategory ?? job.customer_category ?? DEFAULT_CUSTOMER_CATEGORY;

    const previews = previewPromptsForJob({
      confirmedType: jewelleryType,
      template,
      presenter,
      generateRoseGold,
      overridesByAssetType: input.promptOverrides,
      confirmedCustomerCategory: customerCategory,
    });

    res.json({ prompts: previews });
  } catch (err) {
    next(err);
  }
}

// Regenerate/retry — allowed on a FAILED asset (retry) or a READY one
// (Step 4/5's "Regenerate" action, letting the admin reroll a shot they
// don't like before moving on). Never on PENDING/GENERATING — those are
// already in flight.
export async function retryAsset(req, res, next) {
  try {
    const job = await findJobById(req.params.jobId);
    if (!job || job.product_id !== req.params.id) throw new NotFoundError('Job not found');
    if (!['review_ready', 'partially_failed'].includes(job.status)) {
      throw new AppError(409, `Job cannot be retried from status "${job.status}"`);
    }

    const asset = await findAssetById(req.params.assetId);
    if (!asset || asset.job_id !== job.id) throw new NotFoundError('Asset not found');
    if (!['FAILED', 'READY'].includes(asset.status)) {
      throw new AppError(409, 'Only a failed or completed asset can be regenerated');
    }

    await resetAssetForRetry(asset.id);
    await updateJob(job.id, { status: 'generating' });
    await boss.send(JOB_AI_STUDIO_GENERATE, { jobId: job.id, assetIds: [asset.id] });

    res.status(202).json({ jobId: job.id });
  } catch (err) {
    next(err);
  }
}

// "Change Gents Presenter" — the ONLY path that creates a new master
// identity after the first one exists for a job (spec: "Only create a new
// presenter when the administrator explicitly selects Change Gents
// Presenter"). Ordinary "Regenerate"/"Retry" on a single Gents presenter
// tile goes through retryAsset above instead, which reuses the job's
// existing gents_master_presenter_key untouched — this endpoint is the only
// one that clears it. Regenerates both Gents presenter shots together (not
// just one), so they always end up back in sync against the same fresh
// identity.
export async function changeGentsPresenter(req, res, next) {
  try {
    const job = await findJobById(req.params.jobId);
    if (!job || job.product_id !== req.params.id) throw new NotFoundError('Job not found');
    if (job.customer_category !== 'GENTS') {
      throw new AppError(400, 'This action is only available for a Gents job');
    }
    if (!['review_ready', 'partially_failed'].includes(job.status)) {
      throw new AppError(409, `Job cannot be regenerated from status "${job.status}"`);
    }

    const assets = await findAssetsByJobId(job.id);
    const presenterAssets = assets.filter((a) => a.asset_type.startsWith('PRESENTER_'));
    if (presenterAssets.length === 0) {
      throw new AppError(400, 'This job has no presenter images to regenerate');
    }

    await updateJob(job.id, { gents_master_presenter_key: null, status: 'generating' });
    await Promise.all(presenterAssets.map((a) => resetAssetForRetry(a.id)));
    await boss.send(JOB_AI_STUDIO_GENERATE, { jobId: job.id, assetIds: presenterAssets.map((a) => a.id) });

    res.status(202).json({ jobId: job.id });
  } catch (err) {
    next(err);
  }
}

// Step 5's per-card select/deselect, "Set as Featured", and "Accept Anyway"
// actions. Setting isFeatured atomically clears every other asset in the job
// first, so exactly one stays featured — only a READY catalogue-type asset
// can be featured (mirrors the DB CHECK constraint). An asset that failed or
// warned validation can't be selected for import until it's been explicitly
// accepted via validationAccepted — the frontend gates this behind its own
// confirmation dialog, this is the server-side backstop.
export async function updateAssetSelection(req, res, next) {
  try {
    const job = await findJobById(req.params.jobId);
    if (!job || job.product_id !== req.params.id) throw new NotFoundError('Job not found');

    const asset = await findAssetById(req.params.assetId);
    if (!asset || asset.job_id !== job.id) throw new NotFoundError('Asset not found');

    const input = selectionSchema.parse(req.body);

    let updated = asset;

    // "Edit Prompt & Regenerate" (Review & Import) — updates just this one
    // asset's prompt ahead of a retry, using the exact same section-builder
    // as the Review Prompts panel so it's never a hand-rolled string.
    // Individual regeneration otherwise keeps everything else about the job
    // untouched (same reference images, same presenter, same metal colour).
    if (input.customCreativeInstructions) {
      const template = await findCategoryTemplate(job.jewellery_type);
      if (!template) throw new AppError(400, `No generation template for "${job.jewellery_type}"`);
      const presenter = job.presenter_id ? await findPresenterById(job.presenter_id) : null;
      const previews = previewPromptsForJob({
        confirmedType: job.jewellery_type,
        template,
        presenter,
        generateRoseGold: job.generate_rose_gold,
        overridesByAssetType: { [asset.asset_type]: input.customCreativeInstructions },
        // Preserve the confirmed category during regeneration (spec) —
        // individual regeneration never re-derives or resets it.
        confirmedCustomerCategory: job.customer_category ?? DEFAULT_CUSTOMER_CATEGORY,
      });
      const preview = previews.find((p) => p.assetType === asset.asset_type);
      if (!preview) throw new AppError(400, 'This asset type is not part of the current generation plan');
      updated = await updateAsset(asset.id, {
        prompt_mode: 'customised',
        custom_creative_instructions: JSON.stringify(input.customCreativeInstructions),
        assembled_final_prompt: preview.finalPrompt,
      });
    }

    if (input.validationAccepted) {
      if (!asset.validation_status || asset.validation_status === 'passed') {
        throw new AppError(400, 'Only an asset with a warning or failed validation needs to be accepted');
      }
      updated = await updateAsset(asset.id, { validation_accepted: true });
    }

    if (input.isFeatured) {
      if (updated.status !== 'READY' || !CATALOGUE_ASSET_TYPES.includes(updated.asset_type)) {
        throw new AppError(400, 'Only a completed catalogue image can be set as featured');
      }
      updated = await withTransaction(async (client) => {
        await clearFeaturedForJobTx(client, job.id);
        return updateAssetTx(client, asset.id, { is_featured: true });
      });
    } else if (input.isFeatured === false) {
      updated = await updateAsset(asset.id, { is_featured: false });
    }

    if (input.selected !== undefined) {
      if (
        input.selected &&
        updated.validation_status &&
        updated.validation_status !== 'passed' &&
        !updated.validation_accepted
      ) {
        throw new AppError(400, 'This image failed validation — accept it before selecting it for import');
      }
      updated = await updateAsset(asset.id, { selected: input.selected });
    }

    res.json({ asset: assetDto(updated) });
  } catch (err) {
    next(err);
  }
}

export async function cancelJob(req, res, next) {
  try {
    const job = await findJobById(req.params.jobId);
    if (!job || job.product_id !== req.params.id) throw new NotFoundError('Job not found');
    if (['importing', 'completed', 'cancelled'].includes(job.status)) {
      throw new AppError(409, `Job cannot be cancelled from status "${job.status}"`);
    }
    // Reference images are never deleted here — only an explicit admin
    // delete removes them (plan §12). Any in-flight generation call checks
    // this status itself before writing back a result.
    await updateJob(job.id, { status: 'cancelled' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Imports exactly one selected+READY+not-yet-imported asset — called
// per-asset by the frontend (sequentially, over every selected asset) so it
// can show a real completed/total progress percentage rather than a fake
// animated bar. Transactional and idempotent per-call: re-calling for an
// already-imported asset is a safe no-op.
export async function importAsset(req, res, next) {
  try {
    const productId = req.params.id;
    const jobId = req.params.jobId;

    const result = await withTransaction(async (client) => {
      const job = await lockJobById(client, jobId);
      if (!job || job.product_id !== productId) throw new NotFoundError('Job not found');
      // 'completed' is included so a job the admin left the Review & Import
      // screen too early on (some assets got auto-deselected by validation
      // and were never accepted/imported, but completeImport still closed
      // the job since every *selected* asset had been imported) can still be
      // reopened later from the "pending review" banner — see getPendingReview.
      if (!['review_ready', 'partially_failed', 'importing', 'completed'].includes(job.status)) {
        throw new AppError(409, `Job is not ready to import (status: ${job.status})`);
      }

      const asset = await lockAssetByIdTx(client, req.params.assetId);
      if (!asset || asset.job_id !== jobId) throw new NotFoundError('Asset not found');
      if (asset.imported) return { alreadyImported: true, asset };
      if (!asset.selected) throw new AppError(400, 'Asset is not selected for import');
      if (asset.status !== 'READY') throw new AppError(409, 'Asset is not ready to import');
      // Belt-and-suspenders with the updateAssetSelection gate above and the
      // frontend's "Accept Anyway" confirmation dialog — a failed/warning
      // image can never actually reach product_images unimported.
      if (asset.validation_status && asset.validation_status !== 'passed' && !asset.validation_accepted) {
        throw new AppError(400, 'This image failed validation and has not been accepted — accept it before importing');
      }

      if (job.status !== 'importing') await updateJobTx(client, jobId, { status: 'importing' });
      if (asset.is_featured) await clearPrimaryForProductTx(client, productId);

      const nextSortOrder = (await findMaxSortOrderTx(client, productId)) + 1;
      const raw = await storageProvider.read(asset.image_key);
      const variants = await processAndStoreImage(productId, raw);

      for (const v of variants) {
        await insertProductImageTx(client, {
          productId,
          type: 'AI_GENERATED',
          variant: v.variant,
          format: v.format,
          url: v.url,
          isPrimary: asset.is_featured,
          sortOrder: nextSortOrder,
        });
      }
      const updated = await updateAssetTx(client, asset.id, { imported: true });
      return { alreadyImported: false, asset: updated };
    });

    res.json({ imported: true, alreadyImported: result.alreadyImported, asset: assetDto(result.asset) });
  } catch (err) {
    next(err);
  }
}

// Finalizes the job once every selected asset has been imported via
// importAsset above — idempotent, callable more than once.
export async function completeImport(req, res, next) {
  try {
    const productId = req.params.id;
    const jobId = req.params.jobId;

    const job = await findJobById(jobId);
    if (!job || job.product_id !== productId) throw new NotFoundError('Job not found');
    if (job.status === 'completed') {
      const images = await findProductImages(productId);
      return res.json({ imported: true, alreadyCompleted: true, images });
    }
    if (job.status !== 'importing') {
      throw new AppError(409, `Job is not mid-import (status: ${job.status})`);
    }

    const assets = await findAssetsByJobId(jobId);
    const selected = assets.filter((a) => a.selected);
    if (selected.some((a) => !a.imported)) {
      throw new AppError(409, 'Not every selected image has been imported yet');
    }

    await updateJob(jobId, { status: 'completed', completed_at: new Date() });
    const images = await findProductImages(productId);
    res.json({ imported: true, alreadyCompleted: false, images });
  } catch (err) {
    next(err);
  }
}
