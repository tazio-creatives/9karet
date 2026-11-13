import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../src/config/db.js';
import { boss } from '../../src/jobs/queue.js';
import { insertJob, findAssetsByJobId, findJobById } from '../../src/repositories/aiStudio.repository.js';
import { confirmJob, getJob, retryAsset, importAsset } from '../../src/controllers/aiStudio.controller.js';

// Six-slot AI Studio jobs, end to end through the real controllers and
// database — only the queue is stubbed, so nothing calls OpenAI.

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
     VALUES ('Test Presenter', 'Test', 'http://x/p.jpg', 'http://x/f.jpg', 'http://x/45.jpg', 'http://x/s.jpg',
             'http://x/j.jpg', ARRAY['PENDANT','RING','EARRINGS','BRACELET'])
     RETURNING id`,
  );
  presenterId = presenter.rows[0].id;
});

after(async () => {
  boss.send = originalSend;
  if (created.length) await query('DELETE FROM ai_studio_jobs WHERE id = ANY($1)', [created]);
  if (presenterId) await query('DELETE FROM presenters WHERE id = $1', [presenterId]);
});

// Runs an Express handler and resolves with what it sent (or the error it
// passed to next).
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

async function newJob() {
  const job = await insertJob({ productId, referenceImageUrls: ['http://x/ref.jpg'] });
  created.push(job.id);
  await query("UPDATE ai_studio_jobs SET status = 'awaiting_confirmation' WHERE id = $1", [job.id]);
  return job;
}

// Closes a job so the next test can open a new one for the same product.
async function closeJob(jobId) {
  await query("UPDATE ai_studio_jobs SET status = 'cancelled' WHERE id = $1", [jobId]);
}

async function confirm(job, body) {
  return call(confirmJob, { params: { id: productId, jobId: job.id }, body });
}

describe('six-slot AI Studio jobs', () => {
  test('a new job starts with Rose Gold OFF', async () => {
    const job = await newJob();
    assert.equal(job.generate_rose_gold, false);
    await closeJob(job.id);
  });

  test('Rose Gold OFF: 4 yellow catalogue + 2 yellow presenter slots, stored as a manifest, nothing rose', async () => {
    const job = await newJob();
    const res = await confirm(job, { jewelleryType: 'EARRINGS', customerCategory: 'GENTS' });
    assert.equal(res.status, 202);

    const saved = await findJobById(job.id);
    assert.equal(saved.generate_rose_gold, false);
    assert.deepEqual(
      saved.output_manifest.map((m) => m.slotKey),
      ['yellow_catalogue_1', 'yellow_catalogue_2', 'yellow_catalogue_3', 'yellow_catalogue_4', 'yellow_presenter_1', 'yellow_presenter_2'],
    );
    const assets = await findAssetsByJobId(job.id);
    assert.equal(assets.length, 6);
    assert.deepEqual(assets.map((a) => a.display_order), [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(assets.map((a) => a.slot_key), saved.output_manifest.map((m) => m.slotKey));
    assert.ok(assets.every((a) => !/ROSE/.test(a.asset_type)));
    assert.ok(assets.every((a) => !/rose gold/i.test(a.assembled_final_prompt)));
    await closeJob(job.id);
  });

  test('Rose Gold ON (Ring): 2 yellow + 2 rose catalogue, 1 yellow + 1 rose presenter', async () => {
    const job = await newJob();
    const res = await confirm(job, { jewelleryType: 'RING', generateRoseGold: true });
    assert.equal(res.status, 202);

    const saved = await findJobById(job.id);
    assert.equal(saved.generate_rose_gold, true);
    const assets = await findAssetsByJobId(job.id);
    assert.deepEqual(
      assets.map((a) => `${a.slot_key}=${a.asset_type}`),
      [
        'yellow_catalogue_1=RING_GOLD_HERO',
        'yellow_catalogue_2=RING_GOLD_FRONT',
        'rose_catalogue_1=RING_ROSE_HERO',
        'rose_catalogue_2=RING_ROSE_FRONT',
        'yellow_presenter_1=RING_HAND_1',
        'rose_presenter_1=RING_HAND_ROSE',
      ],
    );
    await closeJob(job.id);
  });

  // The eight required customer category × Rose Gold combinations, through
  // the real confirm endpoint. Women/Unisex use the chosen presenter; Gents
  // the fixed male identity; Kids (no child presenter) the first image.
  for (const customerCategory of ['WOMEN', 'UNISEX', 'GENTS', 'KIDS']) {
    for (const generateRoseGold of [false, true]) {
      test(`${customerCategory} + Rose Gold ${generateRoseGold ? 'ON' : 'OFF'}: six slots with the right metals and one identity`, async () => {
        const job = await newJob();
        const needsPresenter = customerCategory === 'WOMEN' || customerCategory === 'UNISEX';
        const res = await confirm(job, {
          jewelleryType: 'PENDANT',
          customerCategory,
          generateRoseGold,
          presenterId: needsPresenter ? presenterId : null,
        });
        assert.equal(res.status, 202, res.error?.message);

        const saved = await findJobById(job.id);
        assert.equal(saved.generate_rose_gold, generateRoseGold);
        assert.equal(saved.customer_category, customerCategory);
        assert.equal(saved.jewellery_type, 'PENDANT');
        assert.equal(saved.presenter_id, needsPresenter ? presenterId : null);

        const assets = await findAssetsByJobId(job.id);
        const slots = saved.output_manifest;
        const n = (kind, metal) => slots.filter((m) => m.kind === kind && m.metal === metal).length;
        assert.equal(assets.length, 6);
        assert.deepEqual(
          [n('catalogue', 'YELLOW'), n('catalogue', 'ROSE'), n('presenter', 'YELLOW'), n('presenter', 'ROSE')],
          generateRoseGold ? [2, 2, 1, 1] : [4, 0, 2, 0],
        );
        assert.equal(assets.filter((a) => /ROSE/.test(a.asset_type)).length, generateRoseGold ? 3 : 0);

        const [p1, p2] = slots.filter((m) => m.kind === 'presenter');
        assert.equal(p1.identity.source, p2.identity.source);
        assert.equal(p1.identity.presenterId, p2.identity.presenterId);
        assert.equal(
          p1.identity.source,
          { WOMEN: 'PRESENTER_PHOTO', UNISEX: 'PRESENTER_PHOTO', GENTS: 'GENTS_MASTER', KIDS: 'FIRST_OUTPUT' }[customerCategory],
        );
        assert.equal(p2.identity.referenceSlot, customerCategory === 'KIDS' ? p1.slotKey : null);
        await closeJob(job.id);
      });
    }
  }

  test('a chained second presenter image can only be regenerated once the first has succeeded', async () => {
    const job = await newJob();
    await confirm(job, { jewelleryType: 'RING', generateRoseGold: true });
    const assets = await findAssetsByJobId(job.id);
    const first = assets.find((a) => a.slot_key === 'yellow_presenter_1');
    const second = assets.find((a) => a.slot_key === 'rose_presenter_1');
    for (const a of assets) {
      await query("UPDATE ai_studio_assets SET status = 'READY', image_key = $2 WHERE id = $1", [a.id, `k/${a.slot_key}.png`]);
    }
    await query("UPDATE ai_studio_assets SET status = 'FAILED' WHERE id = ANY($1)", [[first.id, second.id]]);
    await query("UPDATE ai_studio_jobs SET status = 'partially_failed' WHERE id = $1", [job.id]);

    const blocked = await call(retryAsset, { params: { id: productId, jobId: job.id, assetId: second.id } });
    assert.equal(blocked.status, 409);
    assert.match(blocked.error.message, /first presenter image/i);

    await query("UPDATE ai_studio_assets SET status = 'READY' WHERE id = $1", [first.id]);
    sent.length = 0;
    const ok = await call(retryAsset, { params: { id: productId, jobId: job.id, assetId: second.id } });
    assert.equal(ok.status, 202);
    assert.deepEqual(sent.map((s) => s.data.assetIds), [[second.id]]);
    const after = await findAssetsByJobId(job.id);
    assert.equal(after.find((a) => a.id === first.id).image_key, 'k/yellow_presenter_1.png');
    assert.equal(after.find((a) => a.id === first.id).status, 'READY');
    await closeJob(job.id);
  });

  test('Women/Unisex need a presenter, since both presenter images use their photos', async () => {
    const job = await newJob();
    const res = await confirm(job, { jewelleryType: 'PENDANT', customerCategory: 'WOMEN' });
    assert.equal(res.status, 400);
    assert.match(res.error.message, /choose a presenter/i);
    assert.equal((await findAssetsByJobId(job.id)).length, 0);
    await closeJob(job.id);
  });

  test('progress is out of 6; retrying one failed slot leaves the other five untouched; import waits for all six', async () => {
    const job = await newJob();
    await confirm(job, { jewelleryType: 'BANGLE', customerCategory: 'KIDS' });
    const assets = await findAssetsByJobId(job.id);

    // Five slots succeed, one fails.
    for (const a of assets.slice(0, 5)) {
      await query("UPDATE ai_studio_assets SET status = 'READY', image_key = $2, selected = true WHERE id = $1", [a.id, `k/${a.slot_key}.png`]);
    }
    const failed = assets[5];
    await query("UPDATE ai_studio_assets SET status = 'FAILED', error = 'boom' WHERE id = $1", [failed.id]);
    await query("UPDATE ai_studio_jobs SET status = 'partially_failed' WHERE id = $1", [job.id]);

    const view = await call(getJob, { params: { id: productId, jobId: job.id } });
    assert.deepEqual(view.body.job.progress, { completed: 5, expected: 6, percent: 83 });

    // Import is blocked while a slot has not succeeded.
    const blocked = await call(importAsset, { params: { id: productId, jobId: job.id, assetId: assets[0].id } });
    assert.equal(blocked.status, 409);
    assert.match(blocked.error.message, /all 6 images must be generated successfully/i);

    // Retry only the failed slot.
    sent.length = 0;
    const retry = await call(retryAsset, { params: { id: productId, jobId: job.id, assetId: failed.id } });
    assert.equal(retry.status, 202);
    assert.deepEqual(sent.map((s) => s.data.assetIds), [[failed.id]]);
    const after = await findAssetsByJobId(job.id);
    for (const a of after.slice(0, 5)) {
      assert.equal(a.status, 'READY');
      assert.equal(a.image_key, `k/${a.slot_key}.png`);
    }
    assert.equal(after[5].status, 'PENDING');
    assert.equal(after[5].slot_key, failed.slot_key);
    await closeJob(job.id);
  });

  test('older jobs without a manifest keep their behaviour: no progress figure, no six-slot import gate', async () => {
    const job = await newJob();
    await query("UPDATE ai_studio_jobs SET status = 'review_ready', jewellery_type = 'EARRINGS' WHERE id = $1", [job.id]);
    await query(
      "INSERT INTO ai_studio_assets (job_id, asset_type, display_order, status) VALUES ($1, 'YELLOW_FRONT', 0, 'READY'), ($1, 'ROSE_HERO_45', 3, 'FAILED')",
      [job.id],
    );
    const view = await call(getJob, { params: { id: productId, jobId: job.id } });
    assert.equal(view.body.job.outputManifest, null);
    assert.equal(view.body.job.progress, null);
    await closeJob(job.id);
  });
});
