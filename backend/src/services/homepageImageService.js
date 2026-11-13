import sharp from 'sharp';
import crypto from 'node:crypto';
import { storageProvider } from '../providers/storage/index.js';

// Homepage banners (hero, collection cards, etc.) are marketing images, not
// a product photo gallery — one normalized size is enough, unlike
// imageProcessingService's four responsive variants for PLP/PDP.
const MAX_WIDTH = 1920;

async function processAndStore(folder, sourceBuffer) {
  const key = `${folder}/${crypto.randomUUID()}.webp`;
  const buffer = await sharp(sourceBuffer)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  return storageProvider.save(key, buffer);
}

export async function processAndStoreHomepageImage(sourceBuffer) {
  return processAndStore('homepage', sourceBuffer);
}

export async function processAndStoreBlogImage(sourceBuffer) {
  return processAndStore('blog', sourceBuffer);
}

export async function processAndStoreCategoryImage(sourceBuffer) {
  return processAndStore('categories', sourceBuffer);
}
