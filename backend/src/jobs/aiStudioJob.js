import crypto from 'node:crypto';
import { boss, createQueueSafe } from './queue.js';
import { env } from '../config/env.js';
import { storageProvider } from '../providers/storage/index.js';
import {
  analyseJewellery,
  generateShot,
  presenterReferenceKeyFor,
  validateGeneratedImage,
  metalColorForAssetType,
  generateGentsMasterPresenter,
  IDENTITY_SOURCES,
} from '../services/aiStudioService.js';
import {
  findJobById,
  updateJob,
  findAssetsByJobId,
  updateAsset,
  findCategoryTemplate,
} from '../repositories/aiStudio.repository.js';
import { findPresenterById } from '../repositories/presenters.repository.js';
import { keyFromUrl } from '../utils/storageKey.js';

export const JOB_AI_STUDIO_ANALYSE = 'ai-studio-analyse';
export const JOB_AI_STUDIO_GENERATE = 'ai-studio-generate';

// pg-boss v10's work() callback receives an array of jobs (batch fetch) even
// though boss.send() always enqueues one at a time — same gotcha as every
// other job handler in this codebase (pricingJobs.js, aiImageJob.js).
async function analyseHandler(jobs) {
  const [job] = jobs;
  const { jobId, referenceKey, mimetype } = job.data;

  try {
    const buffer = await storageProvider.read(referenceKey);
    const analysis = await analyseJewellery(buffer, mimetype);
    await updateJob(jobId, {
      status: 'awaiting_confirmation',
      analysis: JSON.stringify(analysis),
      analysis_confidence: analysis.jewelleryTypeConfidence,
      ai_detected_category: analysis.jewelleryType,
      ai_detected_customer_category: analysis.customerCategory,
    });
  } catch (err) {
    await updateJob(jobId, { status: 'failed', error: err.message });
  }
}

// Runs `fn` over `items` with at most `limit` in flight at once — 4 items,
// max concurrency 4 by default, but configurable/boundable without pulling
// in a dependency for what's a tiny fixed-size worker pool.
async function runWithConcurrency(items, limit, fn) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export function deriveJobStatus(assets) {
  const readyCount = assets.filter((a) => a.status === 'READY').length;
  const failedCount = assets.filter((a) => a.status === 'FAILED').length;
  if (readyCount === assets.length) return 'review_ready';
  if (readyCount > 0 && failedCount > 0) return 'partially_failed';
  if (failedCount === assets.length) return 'failed';
  return null; // still in flight
}

// Defaults the featured/primary catalogue image to YELLOW_FRONT the first
// time a job has any READY assets and none is featured yet — a no-op on
// every subsequent call (including after an individual regenerate), so it
// never overrides an admin's later "Set as Featured" choice from Step 5.
async function ensureDefaultFeatured(jobId, assets, outputManifest) {
  if (assets.some((a) => a.is_featured)) return;
  // Six-slot jobs: the first yellow-gold catalogue slot is the primary image.
  if (outputManifest) {
    const first = assets.find((a) => a.slot_key === outputManifest[0].slotKey && a.status === 'READY');
    if (first) await updateAsset(first.id, { is_featured: true });
    return;
  }
  const front = assets.find(
    (a) => (a.asset_type === 'YELLOW_FRONT' || a.asset_type === 'RING_GOLD_FRONT') && a.status === 'READY',
  );
  if (front) await updateAsset(front.id, { is_featured: true });
}

// Ring's two hand-wearing lifestyle shots get one automatic retry when
// validation fails, before falling back to the normal manual "Accept Anyway /
// Regenerate" flow every other asset type already has — client spec: "If
// validation fails, regenerate the affected image automatically." Capped at
// exactly one extra attempt (not an unbounded loop) since each attempt is a
// real, billed OpenAI image-edit + vision call.
const RING_HAND_AUTO_RETRY_TYPES = new Set(['RING_HAND_1', 'RING_HAND_2', 'RING_HAND_ROSE']);

// Gents/Kids describe the presenter demographic purely in text (see
// audiencePresenterOverrideFor in aiStudioService.js) — the presenter
// library only has adult female reference photography today, so attaching
// a real presenter's photo here would directly contradict that text and
// confuse the image model. Compositing is skipped for these two categories
// regardless of which library presenter was picked; the boolean "generate
// presenter shots at all" choice (picking a presenter vs. "No Presenter")
// is unaffected.
const AUDIENCE_OVERRIDE_CATEGORIES = new Set(['GENTS', 'KIDS']);

// Which reference images a slot is generated with.
//   Six-slot jobs follow the slot's resolved identity (see buildJobPlan):
//     PRESENTER_PHOTO → the chosen presenter's photo for this pose
//     GENTS_MASTER    → the job's male identity portrait
//     FIRST_OUTPUT    → the first presenter image, for the second slot only
//   Older jobs keep their original rule (presenter photo unless Gents/Kids,
//   Gents master for PRESENTER_* shots).
async function referencesFor({
  asset,
  outputSlot,
  presenter,
  confirmedCustomerCategory,
  gentsMasterPresenterBuffer,
  chainedIdentityBuffer,
}) {
  const poseKey = presenterReferenceKeyFor(asset.asset_type);
  const identity = outputSlot?.identity;
  if (identity) {
    if (identity.source === IDENTITY_SOURCES.PRESENTER_PHOTO && presenter && poseKey) {
      return { presenterReferenceBuffer: await storageProvider.read(keyFromUrl(presenter[poseKey])) };
    }
    if (identity.source === IDENTITY_SOURCES.GENTS_MASTER) {
      return { identityReferenceBuffer: gentsMasterPresenterBuffer, identityKind: 'GENTS_MASTER' };
    }
    if (identity.referenceSlot) {
      return { identityReferenceBuffer: chainedIdentityBuffer, identityKind: identity.subject === 'HAND' ? 'HAND' : 'CHILD' };
    }
    return {};
  }

  const result = {};
  if (presenter && poseKey && !AUDIENCE_OVERRIDE_CATEGORIES.has(confirmedCustomerCategory)) {
    result.presenterReferenceBuffer = await storageProvider.read(keyFromUrl(presenter[poseKey]));
  }
  if (confirmedCustomerCategory === 'GENTS' && asset.asset_type.startsWith('PRESENTER_')) {
    result.identityReferenceBuffer = gentsMasterPresenterBuffer;
    result.identityKind = 'GENTS_MASTER';
  }
  return result;
}

// Six-slot jobs whose presenter identity is chained (Kids without a saved
// child reference, and every Ring hand pair) generate in two waves: every
// other slot first, in parallel; then the second presenter image, once the
// first one has finished, using it as the identity reference.
export function splitGenerationWaves(targets, outputManifest) {
  if (!outputManifest) return { firstWave: targets, chained: [] };
  const slotOf = (a) => outputManifest.find((m) => m.slotKey === a.slot_key);
  const chained = targets.filter((a) => slotOf(a)?.identity?.referenceSlot);
  return { firstWave: targets.filter((a) => !chained.includes(a)), chained };
}

async function generateOneAsset({
  jobId,
  asset,
  referenceBuffer,
  mimetype,
  template,
  confirmedType,
  presenter,
  imageModel,
  generateRoseGold,
  confirmedCustomerCategory,
  gentsMasterPresenterBuffer,
  // Six-slot jobs: this asset's manifest slot, and — for a chained second
  // presenter image — the first presenter image to use as its identity.
  outputSlot,
  chainedIdentityBuffer,
}) {
  // A cancelled job's late-arriving results are discarded, never written
  // back (plan §12) — checked immediately before each write, not just once
  // up front, since cancellation can land mid-flight.
  const current = await findJobById(jobId);
  if (current.status === 'cancelled') return;

  await updateAsset(asset.id, { status: 'GENERATING', generation_started_at: new Date() });

  try {
    const { presenterReferenceBuffer, identityReferenceBuffer, identityKind } = await referencesFor({
      asset,
      outputSlot,
      presenter,
      confirmedCustomerCategory,
      gentsMasterPresenterBuffer,
      chainedIdentityBuffer,
    });

    // A retry after a failed/warning validation gets a fresh prompt with the
    // prior failure folded in as a correction instruction, instead of
    // reusing the originally-confirmed assembled_final_prompt verbatim for
    // that one attempt — otherwise the same mistake just repeats.
    const initialPriorFailure =
      asset.validation_status && asset.validation_status !== 'passed' && asset.validation_result
        ? (asset.validation_result.validationMessages ?? []).join('; ')
        : null;

    async function attemptOnce(priorFailure) {
      const { buffer, prompt } = await generateShot({
        referenceBuffer,
        mimetype,
        template,
        assetType: asset.asset_type,
        confirmedType,
        presenter,
        presenterReferenceBuffer,
        identityReferenceBuffer,
        creative: asset.custom_creative_instructions ?? undefined,
        priorFailure,
        promptOverride: priorFailure ? undefined : (asset.assembled_final_prompt ?? undefined),
        generateRoseGold,
        confirmedCustomerCategory,
        outputSlot,
      });

      // Post-generation validation (Problems 1 & 2) — never lets a failure
      // here take down an otherwise-successful generation; the image is real
      // and viewable either way, it just goes unvalidated (validationStatus
      // stays null, which the frontend treats the same as "needs review").
      let validationStatus = null;
      let validationResult = null;
      try {
        const result = await validateGeneratedImage({
          generatedBuffer: buffer,
          referenceBuffer,
          referenceMimetype: mimetype,
          confirmedType,
          metalColor: metalColorForAssetType(asset.asset_type, generateRoseGold),
          assetType: asset.asset_type,
          confirmedCustomerCategory,
          identityReferenceBuffer,
          identityReferenceMimetype: identityReferenceBuffer ? 'image/png' : null,
          identityKind,
        });
        validationStatus = result.validationStatus;
        validationResult = result;
      } catch (validationErr) {
        console.error('AI Image Studio post-generation validation failed:', validationErr.message);
      }
      return { buffer, prompt, validationStatus, validationResult };
    }

    let attempt = await attemptOnce(initialPriorFailure);
    if (RING_HAND_AUTO_RETRY_TYPES.has(asset.asset_type) && attempt.validationStatus === 'failed') {
      const autoRetryFailure = (attempt.validationResult?.validationMessages ?? []).join('; ') || initialPriorFailure;
      attempt = await attemptOnce(autoRetryFailure);
    }
    const { buffer, prompt, validationStatus, validationResult } = attempt;

    const stillActive = await findJobById(jobId);
    if (stillActive.status === 'cancelled') return;

    const saved = await storageProvider.save(
      `products/ai-studio/${jobId}/${crypto.randomUUID()}.png`,
      buffer,
    );

    // is_featured is deliberately NOT set here — see ensureDefaultFeatured,
    // called once per generation run in generateHandler below. Setting it
    // per-asset would re-stomp an admin's later "Set as Featured" choice
    // (Step 5) every time that same asset gets individually regenerated.
    await updateAsset(asset.id, {
      status: 'READY',
      image_key: saved.key,
      generation_metadata: JSON.stringify({ prompt, imageModel }),
      generation_completed_at: new Date(),
      validation_status: validationStatus,
      validation_result: validationResult ? JSON.stringify(validationResult) : null,
      // A fresh image always needs a fresh accept — a prior "Accept Anyway"
      // never carries over from the image it was actually about.
      validation_accepted: false,
      // `selected` defaults to true at row creation (before validation has
      // even run). A warning/failed result must drop it back out of the
      // default import batch — otherwise it rides along selected-but-hidden
      // (Review & Import hides its checkbox behind the review-actions UI)
      // until the import step hits the server-side validation gate and
      // 400s, silently aborting the whole batch partway through.
      selected: validationStatus && validationStatus !== 'passed' ? false : asset.selected,
    });
  } catch (err) {
    const stillActive = await findJobById(jobId);
    if (stillActive.status === 'cancelled') return;
    await updateAsset(asset.id, {
      status: 'FAILED',
      error: err.message,
      generation_completed_at: new Date(),
      retry_count: asset.retry_count + 1,
    });
  }
}

async function generateHandler(jobs) {
  const [job] = jobs;
  const { jobId, assetIds } = job.data;

  const aiStudioJob = await findJobById(jobId);
  if (!aiStudioJob || aiStudioJob.status === 'cancelled') return;

  try {
    const template = await findCategoryTemplate(aiStudioJob.jewellery_type);
    if (!template) throw new Error(`No category template for "${aiStudioJob.jewellery_type}"`);

    const referenceUrls = aiStudioJob.reference_image_urls;
    const referenceBuffer = await storageProvider.read(keyFromUrl(referenceUrls[0]));
    const mimetype = 'image/jpeg';
    const presenter = aiStudioJob.presenter_id ? await findPresenterById(aiStudioJob.presenter_id) : null;

    const allAssets = await findAssetsByJobId(jobId);
    const targets = assetIds
      ? allAssets.filter((a) => assetIds.includes(a.id))
      : allAssets.filter((a) => a.status === 'PENDING');

    // Gents identity consistency: generate the master presenter portrait
    // once per job (before the concurrent loop below, so every Gents
    // PRESENTER_* target in this batch — whether that's both shots on first
    // generation, or just one on an individual regenerate — shares the
    // exact same reference) and reuse it on every later run via the stored
    // key, never generating a second one unless the job's own key was
    // explicitly cleared by "Change Gents Presenter" (see
    // changeGentsPresenter in aiStudio.controller.js).
    let gentsMasterPresenterBuffer = null;
    const manifest = aiStudioJob.output_manifest;
    const slotOf = (a) => manifest?.find((m) => m.slotKey === a.slot_key);
    const isGents = aiStudioJob.customer_category === 'GENTS';
    const hasGentsPresenterTarget = manifest
      ? targets.some((a) => slotOf(a)?.identity?.source === IDENTITY_SOURCES.GENTS_MASTER)
      : isGents && targets.some((a) => a.asset_type.startsWith('PRESENTER_'));
    if (hasGentsPresenterTarget) {
      if (aiStudioJob.gents_master_presenter_key) {
        gentsMasterPresenterBuffer = await storageProvider.read(aiStudioJob.gents_master_presenter_key);
      } else {
        const { buffer: masterBuffer } = await generateGentsMasterPresenter();
        const savedMaster = await storageProvider.save(
          `products/ai-studio/${jobId}/gents-master-${crypto.randomUUID()}.png`,
          masterBuffer,
        );
        await updateJob(jobId, { gents_master_presenter_key: savedMaster.key });
        gentsMasterPresenterBuffer = masterBuffer;
      }
    }

    const shared = {
      jobId,
      referenceBuffer,
      mimetype,
      template,
      confirmedType: aiStudioJob.jewellery_type,
      presenter,
      imageModel: env.openaiImageModel,
      generateRoseGold: aiStudioJob.generate_rose_gold,
      confirmedCustomerCategory: aiStudioJob.customer_category,
      gentsMasterPresenterBuffer,
    };
    const { firstWave, chained } = splitGenerationWaves(targets, manifest);

    await runWithConcurrency(firstWave, env.aiStudioGenerationConcurrency, (asset) =>
      generateOneAsset({ ...shared, asset, outputSlot: slotOf(asset) }),
    );

    // Second presenter images wait for the first, then use it as identity.
    for (const asset of chained) {
      if ((await findJobById(jobId)).status === 'cancelled') return;
      const outputSlot = slotOf(asset);
      const reference = (await findAssetsByJobId(jobId)).find((a) => a.slot_key === outputSlot.identity.referenceSlot);
      if (reference?.status !== 'READY' || !reference.image_key) {
        await updateAsset(asset.id, {
          status: 'FAILED',
          error: 'The first presenter image did not succeed, so this one was not generated — retry the first one, then this one.',
          generation_completed_at: new Date(),
        });
        continue;
      }
      const chainedIdentityBuffer = await storageProvider.read(reference.image_key);
      await generateOneAsset({ ...shared, asset, outputSlot, chainedIdentityBuffer });
    }

    const refreshedJob = await findJobById(jobId);
    if (refreshedJob.status === 'cancelled') return;

    const refreshedAssets = await findAssetsByJobId(jobId);
    await ensureDefaultFeatured(jobId, refreshedAssets, refreshedJob.output_manifest);
    const derived = deriveJobStatus(refreshedAssets);
    if (derived) await updateJob(jobId, { status: derived });
  } catch (err) {
    await updateJob(jobId, { status: 'failed', error: err.message });
  }
}

export async function registerAiStudioWorker() {
  await createQueueSafe(JOB_AI_STUDIO_ANALYSE);
  // Default pg-boss job expiry is 15 minutes — too tight here. A single
  // generateShot() call has been measured up to ~490s, and with one retry
  // (see aiStudioService.js) plus up to 4 shots each independently able to
  // hit that worst case, 30 minutes gives real headroom before pg-boss would
  // mark the job expired and risk a duplicate concurrent run.
  await createQueueSafe(JOB_AI_STUDIO_GENERATE, { expireInMinutes: 30 });
  await boss.work(JOB_AI_STUDIO_ANALYSE, analyseHandler);
  await boss.work(JOB_AI_STUDIO_GENERATE, generateHandler);
}

// Exported for the retry endpoint, which needs to reset one asset back to
// PENDING before re-enqueuing generation scoped to just that asset id.
// Must also clear the previous run's timestamps — leaving a stale
// generation_completed_at behind made the frontend's elapsed-time display
// compute (old completedAt - new startedAt), a negative number clamped to
// 0, so every regenerate showed "Generating… 0s" stuck for the whole run.
export async function resetAssetForRetry(assetId) {
  return updateAsset(assetId, {
    status: 'PENDING',
    error: null,
    generation_started_at: null,
    generation_completed_at: null,
  });
}
