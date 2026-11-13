// One-time backfill: re-derives the AVIF file for every existing product
// image at the new AVIF_QUALITY (imageProcessingService.js) instead of the
// old quality:60 it was originally saved at. Re-encodes from each image
// group's own 'original' variant (JPEG q95) — always present, never
// touched by this script — not from the existing (already lossy) AVIF
// file, so there's only one lossy re-encode, not a compounding second one.
// WebP is left untouched: its quality hasn't changed, and since
// ImageGallery.tsx now prefers AVIF wherever both exist, WebP is only a
// fallback for browsers without AVIF support.
//
// Overwrites the AVIF file in place at its existing storage key/URL — no
// product_images rows change, so nothing else in the app needs to know
// this ran. If a CDN sits in front of storage in production, its cache for
// these URLs will need invalidating after this runs (nothing in this repo
// currently does that automatically).
//
// Safe to re-run (idempotent — re-encoding the same source at the same
// quality again is a no-op in effect). Run with no flags first to see what
// it would touch; pass --apply to actually write.
//
// Usage:
//   node backend/scripts/backfillAvifQuality.js            (dry run)
//   node backend/scripts/backfillAvifQuality.js --apply

import sharp from 'sharp';
import { query, pool } from '../src/config/db.js';
import { storageProvider } from '../src/providers/storage/index.js';

const AVIF_QUALITY = 85;
const VARIANT_WIDTHS = { thumbnail: 150, small: 400, medium: 800, large: 1600 };

// Every key this app saves lives under "products/..." (see
// imageProcessingService.js's baseKey) regardless of storage provider —
// the URL is always `${base}/${key}`, so slicing from "products/" recovers
// the key without needing to know which provider (local vs S3) is active.
function keyFromUrl(url) {
  const idx = url.indexOf('products/');
  if (idx === -1) throw new Error(`Unrecognized image URL shape: ${url}`);
  return url.slice(idx);
}

async function main() {
  const apply = process.argv.includes('--apply');

  const { rows: originals } = await query(
    `SELECT product_id, sort_order, url FROM product_images WHERE variant = 'original' ORDER BY product_id, sort_order`,
  );
  console.log(`Found ${originals.length} image group(s) to reprocess.${apply ? '' : ' (dry run — pass --apply to write)'}`);

  let processed = 0;
  let failed = 0;

  for (const orig of originals) {
    try {
      const { rows: avifRows } = await query(
        `SELECT variant, url FROM product_images WHERE product_id = $1 AND sort_order = $2 AND format = 'avif'`,
        [orig.product_id, orig.sort_order],
      );
      if (avifRows.length === 0) continue;

      if (!apply) {
        processed++;
        continue;
      }

      const sourceBuffer = await storageProvider.read(keyFromUrl(orig.url));

      for (const row of avifRows) {
        const width = VARIANT_WIDTHS[row.variant];
        if (!width) continue; // defensive — every real row matches one of the four
        const buffer = await sharp(sourceBuffer)
          .resize({ width, withoutEnlargement: true })
          .avif({ quality: AVIF_QUALITY })
          .toBuffer();
        await storageProvider.save(keyFromUrl(row.url), buffer);
      }

      processed++;
      if (processed % 20 === 0) console.log(`  ...${processed}/${originals.length}`);
    } catch (err) {
      failed++;
      console.error(`FAILED product ${orig.product_id} sort_order ${orig.sort_order}: ${err.message}`);
    }
  }

  console.log(`\nDone. ${apply ? 'Reprocessed' : 'Would reprocess'} ${processed}, failed ${failed}.`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    return pool.end().then(() => process.exit(1));
  });
