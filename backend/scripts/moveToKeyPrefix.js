// One-off: put every file this site's database references under the
// S3_KEY_PREFIX folder (9karet/…) in the shared bucket.
//
// Files are COPIED, never moved or deleted — the originals stay where they
// are, so anything else using them (BOX shares the presenter photos) is
// untouched, and undoing this is just restoring the database backup.
//
//   node scripts/moveToKeyPrefix.js inventory   # counts only
//   node scripts/moveToKeyPrefix.js copy        # server-side S3 copies (idempotent)
//   node scripts/moveToKeyPrefix.js verify      # every copy exists, same size and type
//   node scripts/moveToKeyPrefix.js update-db   # re-checks, then rewrites references in one transaction
import { S3Client, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../src/config/env.js';
import { pool, query } from '../src/config/db.js';

const PREFIX = env.s3KeyPrefix;
const BUCKET = env.s3Bucket;
const BASE = (env.s3PublicBaseUrl || `https://${BUCKET}.s3.${env.s3Region}.amazonaws.com`).replace(/\/$/, '');
const CONCURRENCY = 16;

if (env.storageProvider !== 's3' || !PREFIX || !BUCKET) {
  console.error('Needs STORAGE_PROVIDER=s3, S3_BUCKET and S3_KEY_PREFIX.');
  process.exit(1);
}

const s3 = new S3Client({
  region: env.s3Region,
  ...(env.s3AccessKeyId && env.s3SecretAccessKey
    ? { credentials: { accessKeyId: env.s3AccessKeyId, secretAccessKey: env.s3SecretAccessKey } }
    : {}),
});

const isPrefixed = (key) => key.startsWith(`${PREFIX}/`);
const keyOf = (url) => (url && url.startsWith(`${BASE}/`) ? decodeURIComponent(url.slice(BASE.length + 1)) : null);

// Every not-yet-prefixed object key the database references.
async function collectKeys() {
  const keys = new Set();
  const add = (k) => k && !isPrefixed(k) && keys.add(k);

  for (const { url } of (await query('SELECT url FROM product_images')).rows) add(keyOf(url));
  for (const { reference_image_urls: urls, gents_master_presenter_key: g } of (
    await query('SELECT reference_image_urls, gents_master_presenter_key FROM ai_studio_jobs')
  ).rows) {
    for (const u of urls ?? []) add(keyOf(u));
    add(g);
  }
  for (const { image_key: k } of (await query('SELECT image_key FROM ai_studio_assets WHERE image_key IS NOT NULL')).rows) add(k);
  for (const row of (
    await query(
      'SELECT main_preview_image_url, front_portrait_url, face_45_url, side_profile_url, jewellery_placement_url FROM presenters',
    )
  ).rows) {
    for (const u of Object.values(row)) add(keyOf(u));
  }
  return [...keys];
}

async function runPool(items, fn) {
  let i = 0;
  const failures = [];
  let done = 0;
  async function worker() {
    while (i < items.length) {
      const item = items[i++];
      try {
        await fn(item);
      } catch (err) {
        failures.push({ item, error: err.name || err.message });
      }
      done += 1;
      if (done % 500 === 0) console.log(`  ${done}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return failures;
}

const head = (Key) => s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key }));

async function copyAll(keys) {
  return runPool(keys, async (key) => {
    await s3.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        Key: `${PREFIX}/${key}`,
        CopySource: `${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`,
        MetadataDirective: 'COPY',
      }),
    );
  });
}

async function verifyAll(keys) {
  return runPool(keys, async (key) => {
    const [src, dst] = await Promise.all([head(key), head(`${PREFIX}/${key}`)]);
    if (src.ContentLength !== dst.ContentLength || src.ContentType !== dst.ContentType) {
      throw new Error(`mismatch ${src.ContentLength}/${dst.ContentLength} ${src.ContentType}/${dst.ContentType}`);
    }
  });
}

async function updateDb() {
  const from = `${BASE}/`;
  const to = `${BASE}/${PREFIX}/`;
  const notYet = `${BASE}/${PREFIX}/%`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r1 = await client.query(
      `UPDATE product_images SET url = $2 || substr(url, length($1) + 1) WHERE url LIKE $1 || '%' AND url NOT LIKE $3`,
      [from, to, notYet],
    );
    const r2 = await client.query(
      `UPDATE ai_studio_jobs j SET reference_image_urls = (
         SELECT jsonb_agg(CASE WHEN u LIKE $1 || '%' AND u NOT LIKE $3 THEN $2 || substr(u, length($1) + 1) ELSE u END ORDER BY o)
         FROM jsonb_array_elements_text(j.reference_image_urls) WITH ORDINALITY AS t(u, o))
       WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(j.reference_image_urls) u WHERE u LIKE $1 || '%' AND u NOT LIKE $3)`,
      [from, to, notYet],
    );
    const r3 = await client.query(
      `UPDATE ai_studio_jobs SET gents_master_presenter_key = $1 || '/' || gents_master_presenter_key
       WHERE gents_master_presenter_key IS NOT NULL AND gents_master_presenter_key NOT LIKE $1 || '/%'`,
      [PREFIX],
    );
    const r4 = await client.query(
      `UPDATE ai_studio_assets SET image_key = $1 || '/' || image_key
       WHERE image_key IS NOT NULL AND image_key NOT LIKE $1 || '/%'`,
      [PREFIX],
    );
    let r5 = 0;
    for (const col of ['main_preview_image_url', 'front_portrait_url', 'face_45_url', 'side_profile_url', 'jewellery_placement_url']) {
      const r = await client.query(
        `UPDATE presenters SET ${col} = $2 || substr(${col}, length($1) + 1) WHERE ${col} LIKE $1 || '%' AND ${col} NOT LIKE $3`,
        [from, to, notYet],
      );
      r5 += r.rowCount;
    }
    // Cached storefront HTML may still carry old addresses.
    const r6 = await client.query('DELETE FROM page_cache');
    await client.query('COMMIT');
    console.log(
      `updated: product_images ${r1.rowCount}, job references ${r2.rowCount}, gents keys ${r3.rowCount}, asset keys ${r4.rowCount}, presenter photos ${r5}; page_cache cleared ${r6.rowCount}`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const mode = process.argv[2];
try {
  const keys = await collectKeys();
  console.log(`bucket ${BUCKET}, prefix ${PREFIX}/ — ${keys.length} objects still at the old location`);
  if (mode === 'copy') {
    const failures = await copyAll(keys);
    console.log(`copied ${keys.length - failures.length}, failed ${failures.length}`);
    for (const f of failures.slice(0, 20)) console.log('  FAIL', f.item, f.error);
  } else if (mode === 'verify' || mode === 'update-db') {
    const failures = await verifyAll(keys);
    console.log(`verified ${keys.length - failures.length}, problems ${failures.length}`);
    for (const f of failures.slice(0, 20)) console.log('  PROBLEM', f.item, f.error);
    if (mode === 'update-db') {
      if (failures.length) {
        console.log('Not updating the database: every copy must verify first.');
        process.exitCode = 2;
      } else {
        await updateDb();
      }
    }
  } else if (mode !== 'inventory') {
    console.log('Usage: node scripts/moveToKeyPrefix.js inventory|copy|verify|update-db');
  }
} finally {
  await pool.end();
}
