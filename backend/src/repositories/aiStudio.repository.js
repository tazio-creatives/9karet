import { query } from '../config/db.js';

const PROMPT_VERSION = 'v1';
const TEMPLATE_VERSION = 'v1';

export { PROMPT_VERSION, TEMPLATE_VERSION };

export async function findActiveJobByProduct(productId) {
  const { rows } = await query(
    `SELECT * FROM ai_studio_jobs WHERE product_id = $1
       AND status IN ('draft','uploading','analysing','awaiting_confirmation','generating','importing')
     ORDER BY created_at DESC LIMIT 1`,
    [productId],
  );
  return rows[0] ?? null;
}

// Surfaces a job whose generation finished but that still has a READY,
// unimported asset — regardless of whether the job itself ever reached
// 'completed' (completeImport only requires every *selected* asset to be
// imported, so a job can close out with a validation-flagged asset still
// sitting unaccepted). findActiveJobByProduct deliberately excludes these
// statuses since "resume where I left off" and "something was left behind
// after finishing" are different situations for the UI to surface.
export async function findLatestJobWithPendingAssets(productId) {
  const { rows } = await query(
    `SELECT j.* FROM ai_studio_jobs j
     WHERE j.product_id = $1
       AND j.status IN ('review_ready', 'partially_failed', 'importing', 'completed')
       AND EXISTS (
         SELECT 1 FROM ai_studio_assets a
         WHERE a.job_id = j.id AND a.status = 'READY' AND a.imported = false
       )
     ORDER BY j.created_at DESC LIMIT 1`,
    [productId],
  );
  return rows[0] ?? null;
}

export async function insertJob({
  productId,
  referenceImageUrls,
  analysisModel,
  imageModel,
  existingProductCategory,
}) {
  const { rows } = await query(
    `INSERT INTO ai_studio_jobs
       (product_id, status, reference_image_urls, prompt_version, template_version, analysis_model, image_model, existing_product_category)
     VALUES ($1, 'analysing', $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      productId,
      JSON.stringify(referenceImageUrls),
      PROMPT_VERSION,
      TEMPLATE_VERSION,
      analysisModel ?? null,
      imageModel ?? null,
      existingProductCategory ?? null,
    ],
  );
  return rows[0];
}

export async function findJobById(id) {
  const { rows } = await query('SELECT * FROM ai_studio_jobs WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Row lock for the transactional import path (plan §7/§11) — must be called
// inside withTransaction() with the transaction's own client.
export async function lockJobById(client, id) {
  const { rows } = await client.query('SELECT * FROM ai_studio_jobs WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] ?? null;
}

export async function updateJob(id, fields) {
  const columns = [];
  const values = [];
  for (const [key, value] of Object.entries(fields)) {
    values.push(value);
    columns.push(`${key} = $${values.length}`);
  }
  values.push(id);
  const { rows } = await query(
    `UPDATE ai_studio_jobs SET ${columns.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0];
}

export async function updateJobTx(client, id, fields) {
  const columns = [];
  const values = [];
  for (const [key, value] of Object.entries(fields)) {
    values.push(value);
    columns.push(`${key} = $${values.length}`);
  }
  values.push(id);
  const { rows } = await client.query(
    `UPDATE ai_studio_jobs SET ${columns.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0];
}

export async function findCategoryTemplate(jewelleryType) {
  const { rows } = await query(
    'SELECT * FROM ai_studio_category_templates WHERE jewellery_type = $1 AND is_active = true',
    [jewelleryType],
  );
  return rows[0] ?? null;
}

export async function insertAssets(jobId, rows) {
  const inserted = [];
  for (const { assetType, displayOrder, slotKey } of rows) {
    const {
      rows: [row],
    } = await query(
      `INSERT INTO ai_studio_assets (job_id, asset_type, display_order, slot_key)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [jobId, assetType, displayOrder, slotKey ?? null],
    );
    inserted.push(row);
  }
  return inserted;
}

export async function findAssetsByJobId(jobId) {
  const { rows } = await query(
    'SELECT * FROM ai_studio_assets WHERE job_id = $1 ORDER BY display_order',
    [jobId],
  );
  return rows;
}

export async function findAssetsByJobIdTx(client, jobId) {
  const { rows } = await client.query(
    'SELECT * FROM ai_studio_assets WHERE job_id = $1 ORDER BY display_order FOR UPDATE',
    [jobId],
  );
  return rows;
}

export async function findAssetById(id) {
  const { rows } = await query('SELECT * FROM ai_studio_assets WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Row lock for the per-asset import endpoint — prevents a double-click race
// on the same asset from producing two product_images inserts.
export async function lockAssetByIdTx(client, id) {
  const { rows } = await client.query('SELECT * FROM ai_studio_assets WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] ?? null;
}

export async function updateAsset(id, fields) {
  const columns = [];
  const values = [];
  for (const [key, value] of Object.entries(fields)) {
    values.push(value);
    columns.push(`${key} = $${values.length}`);
  }
  values.push(id);
  const { rows } = await query(
    `UPDATE ai_studio_assets SET ${columns.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0];
}

// --- Transaction-scoped product_images writes for the import step (plan §7) ---
// productImages.repository.js's equivalents run against the shared pool, not
// a passed client, so they can't participate in the import transaction's row
// lock — these duplicate that SQL bound to the transaction's own client.

export async function findMaxSortOrderTx(client, productId) {
  const { rows } = await client.query(
    'SELECT COALESCE(MAX(sort_order), -1) AS max FROM product_images WHERE product_id = $1',
    [productId],
  );
  return rows[0].max;
}

export async function clearPrimaryForProductTx(client, productId) {
  await client.query('UPDATE product_images SET is_primary = false WHERE product_id = $1', [productId]);
}

export async function insertProductImageTx(client, { productId, type, variant, format, url, isPrimary, sortOrder }) {
  const { rows } = await client.query(
    `INSERT INTO product_images (product_id, type, variant, format, url, is_primary, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [productId, type, variant, format, url, isPrimary ?? false, sortOrder ?? 0],
  );
  return rows[0];
}

// Atomic "only one featured asset per job" — pairs with updateAssetTx (set
// the chosen asset's is_featured=true) inside the same transaction, so
// Step 5's "Set as Featured" action can never leave two assets featured.
export async function clearFeaturedForJobTx(client, jobId) {
  await client.query('UPDATE ai_studio_assets SET is_featured = false WHERE job_id = $1', [jobId]);
}

export async function updateAssetTx(client, id, fields) {
  const columns = [];
  const values = [];
  for (const [key, value] of Object.entries(fields)) {
    values.push(value);
    columns.push(`${key} = $${values.length}`);
  }
  values.push(id);
  const { rows } = await client.query(
    `UPDATE ai_studio_assets SET ${columns.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0];
}
