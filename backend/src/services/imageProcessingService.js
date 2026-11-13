import sharp from 'sharp';
import crypto from 'node:crypto';
import { storageProvider } from '../providers/storage/index.js';

// Listing pages request "small", PDP requests "large" (plan §9/§35) — these
// four cover both plus a lightweight thumbnail for admin gallery grids.
const VARIANT_WIDTHS = {
  thumbnail: 150,
  small: 400,
  medium: 800,
  large: 1600,
};

// AVIF is the format actually served (ImageGallery.tsx prefers it over
// WebP wherever both exist) — 85 is well past the point where AV1 artifacts
// are visible on a real screen, without the runaway file size of q90+ or
// true lossless (measured: q60 ~24KB / q75 ~37KB / q85 ~55KB / q100 ~340KB /
// lossless ~630KB, for one 1600px product photo). WebP stays at 75 since
// it's now only a fallback for the rare pre-AVIF browser.
const AVIF_QUALITY = 85;
const WEBP_QUALITY = 75;

// Derives thumbnail/small/medium/large in AVIF+WebP (plan §9) and stores
// the original — normalized to a single high-quality JPEG rather than the
// literal uploaded bytes, since product_images.format is constrained to
// ('avif','webp','jpeg') at the DB level (plan §3). "Never modified" in the
// plan means no cropping/retouching, not byte-for-byte format preservation.
// `quality` lets a caller raise both encoders above the photographic
// defaults above — used only by productSizeImageJob.js, whose source is
// thin black ruler lines and small text rather than a photo, and visibly
// blurs/rings at the AVIF-85/WebP-75 settings tuned for photographic noise.
export async function processAndStoreImage(productId, sourceBuffer, { quality } = {}) {
  const avifQuality = quality?.avif ?? AVIF_QUALITY;
  const webpQuality = quality?.webp ?? WEBP_QUALITY;
  const baseKey = `products/${productId}/${crypto.randomUUID()}`;
  const results = [];

  for (const [variant, width] of Object.entries(VARIANT_WIDTHS)) {
    const resized = sharp(sourceBuffer).resize({ width, withoutEnlargement: true });

    const avifBuffer = await resized.clone().avif({ quality: avifQuality }).toBuffer();
    const avifSaved = await storageProvider.save(`${baseKey}-${variant}.avif`, avifBuffer);
    results.push({ variant, format: 'avif', url: avifSaved.url, key: avifSaved.key });

    const webpBuffer = await resized.clone().webp({ quality: webpQuality }).toBuffer();
    const webpSaved = await storageProvider.save(`${baseKey}-${variant}.webp`, webpBuffer);
    results.push({ variant, format: 'webp', url: webpSaved.url, key: webpSaved.key });
  }

  const originalBuffer = await sharp(sourceBuffer).jpeg({ quality: 95 }).toBuffer();
  const originalSaved = await storageProvider.save(`${baseKey}-original.jpeg`, originalBuffer);
  results.push({ variant: 'original', format: 'jpeg', url: originalSaved.url, key: originalSaved.key });

  return results;
}
