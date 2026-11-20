// Regenerate on a two-bangle set job, through the real controller and
// database: the stored prompt is refreshed to the current two-bangle rules,
// using the job's stored quantity, gold colour, presenter, customer category
// and reference — no new analysis, and only one queue message (one image).
// The queue is stubbed, so nothing calls OpenAI.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../src/config/db.js';
import { boss } from '../../src/jobs/queue.js';
import { insertJob, findAssetsByJobId, findJobById } from '../../src/repositories/aiStudio.repository.js';
import { confirmJob, retryAsset } from '../../src/controllers/aiStudio.controller.js';

const sent = [];
const originalSend = boss.send;
const created = [];
let productId;
let presenterId;

before(async () => {
  boss.send = async (name, data) => {
    sent.push({ name, data });
    return 'stub';
  };
  const { rows } = await query(
    `SELECT p.id FROM products p
     WHERE NOT EXISTS (
       SELECT 1 FROM ai_studio_jobs j
       WHERE j.product_id = p.id AND j.status NOT IN ('completed', 'failed', 'cancelled')
     )
     LIMIT 1`,
  );
  productId = rows[0].id;
  const presenter = await query(
    `INSERT INTO presenters (display_name, style_label, main_preview_image_url, front_portrait_url, face_45_url,
                             side_profile_url, jewellery_placement_url, supported_jewellery_types)
     VALUES ('Bangle Test Presenter', 'Test', 'http://x/p.jpg', 'http://x/f.jpg', 'http://x/45.jpg', 'http://x/s.jpg',
             'http://x/j.jpg', ARRAY['BANGLE'])
     RETURNING id`,
  );
  presenterId = presenter.rows[0].id;
});

after(async () => {
  boss.send = originalSend;
  if (created.length) await query('DELETE FROM ai_studio_jobs WHERE id = ANY($1)', [created]);
  if (presenterId) await query('DELETE FROM presenters WHERE id = $1', [presenterId]);
});

function call(handler, { params, body = {} }) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload });
      },
    };
    handler({ params, body }, res, (err) => resolve({ status: err?.status ?? 500, error: err }));
  });
}

// A confirmed Bangle job whose stored analysis found `wristPieceCount` pieces.
async function confirmedBangleJob(wristPieceCount) {
  const job = await insertJob({ productId, referenceImageUrls: ['http://x/ref.jpg'] });
  created.push(job.id);
  await query("UPDATE ai_studio_jobs SET status = 'awaiting_confirmation', analysis = $2 WHERE id = $1", [
    job.id,
    JSON.stringify({ jewelleryType: 'BANGLE', wristPieceCount }),
  ]);
  const res = await call(confirmJob, {
    params: { id: productId, jobId: job.id },
    body: { jewelleryType: 'BANGLE', customerCategory: 'WOMEN', presenterId },
  });
  assert.equal(res.status, 202);
  const assets = await findAssetsByJobId(job.id);
  assert.equal(assets.length, 6);
  for (const a of assets) {
    await query("UPDATE ai_studio_assets SET status = 'READY', image_key = $2 WHERE id = $1", [a.id, `k/${a.slot_key}.png`]);
  }
  await query("UPDATE ai_studio_jobs SET status = 'review_ready' WHERE id = $1", [job.id]);
  return job;
}

describe('two-bangle set regenerate', () => {
  test('every image of a pair job regenerates with the corrected rules; stored inputs are preserved', async () => {
    const job = await confirmedBangleJob(2);
    const before = await findJobById(job.id);
    const assets = await findAssetsByJobId(job.id);

    for (const asset of assets) {
      // Simulate a prompt stored by the previous (v4) rules.
      await query('UPDATE ai_studio_assets SET assembled_final_prompt = $2 WHERE id = $1', [asset.id, 'OLD PROMPT']);
      await query("UPDATE ai_studio_jobs SET status = 'review_ready' WHERE id = $1", [job.id]);
      sent.length = 0;

      const res = await call(retryAsset, { params: { id: productId, jobId: job.id, assetId: asset.id } });
      assert.equal(res.status, 202, asset.asset_type);
      assert.deepEqual(sent.map((s) => s.data.assetIds), [[asset.id]], 'one queue message, one image');

      const refreshed = (await findAssetsByJobId(job.id)).find((a) => a.id === asset.id);
      const prompt = refreshed.assembled_final_prompt;
      assert.match(prompt, /this image must contain exactly two physical bangles in total/, asset.asset_type);
      assert.match(prompt, /The metal colour is yellow gold/, asset.asset_type);
      if (asset.asset_type === 'PRESENTER_YELLOW_2') assert.match(prompt, /do not hold one wrist with the other hand/);
      if (asset.asset_type === 'YELLOW_ELEVATED_DETAIL') assert.match(prompt, /warm, rich, real yellow gold with natural depth/);
      assert.equal(refreshed.slot_key, asset.slot_key);
      assert.equal(refreshed.asset_type, asset.asset_type);
    }

    const afterJob = await findJobById(job.id);
    assert.deepEqual(afterJob.analysis, before.analysis, 'analysis not re-run');
    assert.equal(afterJob.presenter_id, before.presenter_id);
    assert.equal(afterJob.customer_category, before.customer_category);
    assert.equal(afterJob.generate_rose_gold, before.generate_rose_gold);
    assert.deepEqual(afterJob.reference_image_urls, before.reference_image_urls);
    assert.deepEqual(afterJob.output_manifest, before.output_manifest);
    await query("UPDATE ai_studio_jobs SET status = 'cancelled' WHERE id = $1", [job.id]);
  });

  test('a single-bangle job regenerates without any two-bangle wording', async () => {
    const job = await confirmedBangleJob(1);
    for (const asset of await findAssetsByJobId(job.id)) {
      await query("UPDATE ai_studio_jobs SET status = 'review_ready' WHERE id = $1", [job.id]);
      const res = await call(retryAsset, { params: { id: productId, jobId: job.id, assetId: asset.id } });
      assert.equal(res.status, 202);
      const refreshed = (await findAssetsByJobId(job.id)).find((a) => a.id === asset.id);
      assert.doesNotMatch(refreshed.assembled_final_prompt, /physical bangles in total|duplicated pairs|real yellow gold with natural depth/, asset.asset_type);
      assert.match(refreshed.assembled_final_prompt, /contains exactly one bangle/, asset.asset_type);
    }
    await query("UPDATE ai_studio_jobs SET status = 'cancelled' WHERE id = $1", [job.id]);
  });
});
