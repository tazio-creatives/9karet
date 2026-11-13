import sharp from 'sharp';
import { whitenBackground } from './backgroundWhitening.js';

// Re-exported for existing callers/tests; the implementation now lives in the
// shared helper (identical behaviour).
export { whitenBackground };

// Bracelet-only finishing pass on a freshly generated image — local CPU work
// with sharp, no extra OpenAI call. Bracelets are fine, repetitive detail
// (20px chain links at the API's 1024px output) and were the one category
// where the medium-quality output read as soft, and where the storefront's
// 1600px "large" variant was really the 1024px image stretched by the
// browser. Every other category returns the exact same buffer, untouched.
//
//   1. 2× Lanczos upscale (1024 → 2048), so the large/zoom variants are real
//      pixels rather than browser-stretched ones.
//   2. Gentle unsharp mask — crisper link edges without visible halos.
//   3. Catalogue shots only: whiten the background. Any grey cast shadow or
//      gradient the model still adds is lifted to pure white. Only light,
//      near-neutral pixels in large background regions (touching the image
//      border, or the inside of the bracelet loop) are touched, so gold —
//      always clearly saturated — and small neutral areas such as stones or
//      highlights inside the metal are left exactly as generated. Presenter
//      shots keep their coloured backdrop and skip this step.

const UPSCALE = 2;
// Validation only needs the API's native size; keeps the vision payload as
// small as before.
const VALIDATION_SIZE = 1024;

export async function finishGeneratedImage(buffer, { confirmedType, catalogue }) {
  if (confirmedType !== 'BRACELET') return { buffer, validationBuffer: buffer, finished: false };
  try {
    const { width } = await sharp(buffer).metadata();
    let image = sharp(buffer)
      .removeAlpha()
      .resize({ width: width * UPSCALE, kernel: 'lanczos3' })
      .sharpen({ sigma: 1.1, m1: 0.6, m2: 2.2, x1: 2, y2: 8, y3: 12 });
    if (catalogue) {
      const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
      whitenBackground(data, info.width, info.height, info.channels);
      image = sharp(data, {
        raw: { width: info.width, height: info.height, channels: info.channels },
      });
    }
    const finished = await image.png().toBuffer();
    const validationBuffer = await sharp(finished)
      .resize({ width: VALIDATION_SIZE })
      .png()
      .toBuffer();
    return { buffer: finished, validationBuffer, finished: true };
  } catch (err) {
    // Never lose a paid generation over post-processing — fall back to the
    // image exactly as generated.
    console.error('Bracelet image finishing failed, keeping the original:', err.message);
    return { buffer, validationBuffer: buffer, finished: false };
  }
}

// Measured, not judged: where the bracelet sits in the frame. Free (local
// pixels only) and deterministic, so it backs up the vision check on the two
// framing failures it can catch reliably — a "macro" that still shows the
// whole bracelet, and a full view where the bracelet is cut off or tiny.
// Calibrated on earlier bracelet sets: every genuine close-up touched the
// frame edge, no complete-bracelet view did.
const FULL_VIEW_TYPES = new Set([
  'YELLOW_FRONT',
  'YELLOW_HERO_45',
  'YELLOW_SLIGHT_ANGLE',
  'YELLOW_SIDE',
]);
const MIN_FULL_VIEW_WIDTH = 0.6;
const EDGE = 0.01;

export async function braceletFrameMessages(buffer, { confirmedType, assetType }) {
  if (confirmedType !== 'BRACELET') return [];
  const isMacro = assetType === 'YELLOW_MACRO';
  if (!isMacro && !FULL_VIEW_TYPES.has(assetType)) return [];
  const N = 256;
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .resize(N, N, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = N;
  let y0 = N;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const p = (y * N + x) * info.channels;
      const max = Math.max(data[p], data[p + 1], data[p + 2]);
      const min = Math.min(data[p], data[p + 1], data[p + 2]);
      if ((max - min) / (max || 1) > 0.15 || max < 200) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) return ['Frame check: no bracelet was detected in the image.'];
  const touchesEdge =
    x0 / N <= EDGE || y0 / N <= EDGE || (x1 + 1) / N >= 1 - EDGE || (y1 + 1) / N >= 1 - EDGE;
  const width = (x1 + 1 - x0) / N;
  if (isMacro) {
    return touchesEdge
      ? []
      : [
          'Frame check: the complete bracelet is inside the frame — the Macro Detail View should be a close-up of the central element.',
        ];
  }
  const messages = [];
  if (touchesEdge)
    messages.push(
      'Frame check: the bracelet touches the edge of the frame — part of it may be cut off.',
    );
  if (width < MIN_FULL_VIEW_WIDTH) {
    messages.push(
      `Frame check: the bracelet fills only ${Math.round(width * 100)}% of the frame width — it may be too small to inspect.`,
    );
  }
  return messages;
}
