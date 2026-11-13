import crypto from 'node:crypto';
import sharp from 'sharp';
import { boss, createQueueSafe } from './queue.js';
import { aiImageProvider } from '../providers/aiImage/index.js';
import { storageProvider } from '../providers/storage/index.js';
import { updateAiImageJobStatus, insertGeneratedImage } from '../repositories/aiImages.repository.js';
import { updateProduct, findProductById } from '../repositories/products.repository.js';

export const JOB_AI_IMAGE_GENERATE = 'ai-image-generate';

// plan §10: upload → PENDING job (201 returned immediately, no blocking) →
// worker picks it up → product.status = AI_PROCESSING → provider.startGeneration
// → poll getGenerationStatus → candidates stored → product.status = AI_READY.
// Candidates are stored as a single lightweight preview each (not the full
// thumbnail/small/medium/large set) — full variant derivation only happens
// for the one candidate an admin actually approves (see aiImages.controller.js).
//
// That DRAFT->AI_PROCESSING->AI_READY->PUBLISHED lifecycle only applies to a
// product still being built. Requesting more AI variants for a product
// that's already PUBLISHED (e.g. adding a second photo angle later) must
// not bounce it out of PUBLISHED and off the live storefront — the job
// still runs and produces candidates, it just doesn't touch product.status.
//
// pg-boss v10's work() callback receives an array of jobs (batch fetch),
// not a single job — boss.send() here always enqueues one at a time, so
// batchSize defaults to 1, but the callback shape is still an array.
async function aiImageGenerateHandler(jobs) {
  const [job] = jobs;
  const { jobId, productId, originalKey } = job.data;

  const product = await findProductById(productId);
  const tracksLifecycle = product && product.status !== 'PUBLISHED';

  if (tracksLifecycle) await updateProduct(productId, { status: 'AI_PROCESSING' });
  await updateAiImageJobStatus(jobId, 'PROCESSING');

  try {
    const originalBuffer = await storageProvider.read(originalKey);
    const intent = await aiImageProvider.startGeneration(originalBuffer);
    const results = await aiImageProvider.getGenerationStatus(intent.providerJobId);

    for (const result of results) {
      if (result.status !== 'READY' || !result.imageBuffer) continue;

      const preview = await sharp(result.imageBuffer)
        .resize({ width: 600, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      const saved = await storageProvider.save(
        `products/${productId}/ai-candidates/${crypto.randomUUID()}.jpeg`,
        preview,
      );

      await insertGeneratedImage({
        jobId,
        imageUrl: saved.url,
        providerJobId: result.providerJobId,
        metadata: result.metadata,
      });
    }

    await updateAiImageJobStatus(jobId, 'READY');
    if (tracksLifecycle) await updateProduct(productId, { status: 'AI_READY' });
  } catch (err) {
    await updateAiImageJobStatus(jobId, 'FAILED', err.message);
    if (tracksLifecycle) await updateProduct(productId, { status: 'FAILED' });
  }
}

export async function registerAiImageWorker() {
  await createQueueSafe(JOB_AI_IMAGE_GENERATE);
  await boss.work(JOB_AI_IMAGE_GENERATE, aiImageGenerateHandler);
}
