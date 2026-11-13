// Seeds the Presenter Library with placeholder presenters so the AI Image
// Studio's Step 3 picker/grid/modal are testable end-to-end without real
// presenter photography yet. Run: `npm run seed:presenters` (backend/).
//
// PLACEHOLDER IMAGES: each reference image here is a synthetic solid-color
// tile with a text label (generated via sharp), not a real photo. Swap in
// real presenter photography later by re-running this script with real
// files, or once an admin Presenter Library CRUD screen exists.
//
// Idempotent: re-running clears and re-inserts (ON CONFLICT on display_name).

import 'dotenv/config';
import pg from 'pg';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { storageProvider } from '../../providers/storage/index.js';

const { Client } = pg;

const PLACEHOLDER_SPECS = [
  { field: 'main_preview_image_url', label: 'Preview', color: { r: 79, g: 70, b: 229 } },
  { field: 'front_portrait_url', label: 'Front Portrait', color: { r: 99, g: 102, b: 241 } },
  { field: 'face_45_url', label: '45° Face', color: { r: 129, g: 140, b: 248 } },
  { field: 'side_profile_url', label: 'Side Profile', color: { r: 165, g: 180, b: 252 } },
  { field: 'jewellery_placement_url', label: 'Placement', color: { r: 199, g: 210, b: 254 } },
];

async function makePlaceholder(label, color) {
  const svg = `
    <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="800" fill="rgb(${color.r},${color.g},${color.b})" />
      <text x="400" y="400" font-family="sans-serif" font-size="40" fill="white"
        text-anchor="middle" dominant-baseline="middle">${label}</text>
      <text x="400" y="460" font-family="sans-serif" font-size="22" fill="white" opacity="0.8"
        text-anchor="middle" dominant-baseline="middle">Placeholder — replace later</text>
    </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function uploadPresenterAssets(presenterSlug, styleLabel) {
  const urls = {};
  for (const spec of PLACEHOLDER_SPECS) {
    const buffer = await makePlaceholder(`${styleLabel} — ${spec.label}`, spec.color);
    const saved = await storageProvider.save(
      `presenters/${presenterSlug}/${spec.field}-${crypto.randomUUID()}.jpeg`,
      buffer,
    );
    urls[spec.field] = saved.url;
  }
  return urls;
}

const PRESENTERS = [
  {
    displayName: 'Studio Presenter — Contemporary',
    styleLabel: 'Contemporary',
    promptDescriptor: 'a contemporary presenter with clean, modern, premium studio styling and neutral warm lighting',
    supportedJewelleryTypes: ['RING', 'BRACELET', 'BANGLE', 'NECKLACE', 'PENDANT', 'EARRINGS', 'CHAIN'],
    isDefault: true,
    displayOrder: 0,
  },
  {
    displayName: 'Studio Presenter — Traditional',
    styleLabel: 'Traditional',
    promptDescriptor: 'a traditional presenter with graceful ethnic/festive styling and warm ambient lighting',
    supportedJewelleryTypes: ['RING', 'BRACELET', 'BANGLE', 'NECKLACE', 'PENDANT', 'EARRINGS', 'MANGALSUTRA', 'ANKLET', 'NOSE_PIN'],
    isDefault: false,
    displayOrder: 1,
  },
];

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    for (const presenter of PRESENTERS) {
      const slug = presenter.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const urls = await uploadPresenterAssets(slug, presenter.styleLabel);

      // No unique constraint on display_name (presenters are a small,
      // admin-curated set — a real CRUD screen would handle dedup at the UI
      // layer) — idempotency here is just delete-then-insert by name.
      await client.query('DELETE FROM presenters WHERE display_name = $1', [presenter.displayName]);
      await client.query(
        `INSERT INTO presenters
           (display_name, style_label, main_preview_image_url, front_portrait_url, face_45_url,
            side_profile_url, jewellery_placement_url, prompt_descriptor, supported_jewellery_types,
            is_active, is_default, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11)`,
        [
          presenter.displayName,
          presenter.styleLabel,
          urls.main_preview_image_url,
          urls.front_portrait_url,
          urls.face_45_url,
          urls.side_profile_url,
          urls.jewellery_placement_url,
          presenter.promptDescriptor,
          presenter.supportedJewelleryTypes,
          presenter.isDefault,
          presenter.displayOrder,
        ],
      );
      console.log(`Seeded presenter: ${presenter.displayName}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
