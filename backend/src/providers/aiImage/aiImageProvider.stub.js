import crypto from 'node:crypto';

// Dev/test provider — no real model call. Real providers (Replicate/
// Stability/OpenAI) are URL-based and asynchronous, which is why the
// interface is startGeneration() + poll getGenerationStatus() rather than a
// single synchronous call (plan §10 correction) — this stub still resolves
// immediately (4 READY results), it just goes through the same shape a slow
// real provider would.
//
// getGenerationStatus() only receives providerJobId per the interface (a
// real provider looks the job up server-side); the stub keeps its own
// in-memory map from providerJobId back to the uploaded buffer so it has
// something to hand back as "generated" output without a real model.
const jobBuffers = new Map();

export const stubAiImageProvider = {
  name: 'stub',

  async startGeneration(originalImageBuffer) {
    const providerJobId = `stub_aijob_${crypto.randomUUID()}`;
    jobBuffers.set(providerJobId, originalImageBuffer);
    return { providerJobId, status: 'PENDING' };
  },

  async getGenerationStatus(providerJobId) {
    const buffer = jobBuffers.get(providerJobId);
    jobBuffers.delete(providerJobId);

    return Array.from({ length: 4 }, (_, i) => ({
      status: 'READY',
      imageBuffer: buffer,
      providerJobId,
      metadata: { model: 'stub', variant: i + 1 },
    }));
  },
};
