import { query } from '../config/db.js';

export async function insertAiImageJob({ productId, provider }) {
  const { rows } = await query(
    `INSERT INTO ai_image_jobs (product_id, status, provider) VALUES ($1, 'PENDING', $2) RETURNING *`,
    [productId, provider],
  );
  return rows[0];
}

export async function findLatestAiImageJobByProduct(productId) {
  const { rows } = await query(
    'SELECT * FROM ai_image_jobs WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1',
    [productId],
  );
  return rows[0] ?? null;
}

export async function findAiImageJobById(id) {
  const { rows } = await query('SELECT * FROM ai_image_jobs WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function updateAiImageJobStatus(id, status, error = null) {
  const { rows } = await query(
    `UPDATE ai_image_jobs SET status = $2, error = $3, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, status, error],
  );
  return rows[0];
}

export async function insertGeneratedImage({ jobId, imageUrl, providerJobId, metadata }) {
  const { rows } = await query(
    `INSERT INTO ai_generated_images (job_id, image_url, provider_job_id, metadata)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [jobId, imageUrl, providerJobId ?? null, JSON.stringify(metadata ?? {})],
  );
  return rows[0];
}

export async function findGeneratedImagesByJobId(jobId) {
  const { rows } = await query(
    'SELECT * FROM ai_generated_images WHERE job_id = $1 ORDER BY created_at',
    [jobId],
  );
  return rows;
}

export async function findGeneratedImageById(id) {
  const { rows } = await query('SELECT * FROM ai_generated_images WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function markGeneratedImageApproved(id) {
  const { rows } = await query(
    'UPDATE ai_generated_images SET approved = true WHERE id = $1 RETURNING *',
    [id],
  );
  return rows[0];
}

export async function deleteGeneratedImage(id) {
  await query('DELETE FROM ai_generated_images WHERE id = $1', [id]);
}

export async function deleteUnapprovedGeneratedImagesByJobId(jobId) {
  await query('DELETE FROM ai_generated_images WHERE job_id = $1 AND approved = false', [jobId]);
}
