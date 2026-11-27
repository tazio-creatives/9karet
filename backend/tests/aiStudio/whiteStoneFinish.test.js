// Diamonds / white stones: the prompts copied the stone layout but never said
// how the stones should look, so the model reproduced the dull grey of CAD
// references — production, Aurelia Geometry 9K Gold Sugar-Stone Bracelet,
// 27 Nov 2026: pavé rendered as flat milky-grey dots with dark gaps. Pieces
// whose analysis finds diamonds / white stones now get a stone-finish rule;
// every other piece keeps byte-identical prompts.
// OpenAI is replaced by a fetch stub and the queue is stubbed — nothing here
// makes a network or paid call.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.OPENAI_API_KEY = 'sk-test';
process.env.OPENAI_VISION_MODEL = 'vision-test';
process.env.OPENAI_IMAGE_MODEL = 'image-test';

const svc = await import('../../src/services/aiStudioService.js');
const { TEMPLATE, PRESENTER } = await import('./helpers/promptHashes.mjs');
const { query } = await import('../../src/config/db.js');
const { boss } = await import('../../src/jobs/queue.js');
const { insertJob, findAssetsByJobId } = await import('../../src/repositories/aiStudio.repository.js');
const { confirmJob, previewPrompts, retryAsset } = await import('../../src/controllers/aiStudio.controller.js');

globalThis.fetch = async () => {
  throw new Error('no network calls in this test');
};

const STONE_NOTE = /render every one as a real, bright, clean, icy-white faceted stone/;
const TYPES = ['RING', 'BRACELET', 'BANGLE', 'NECKLACE', 'PENDANT', 'EARRINGS', 'MANGALSUTRA', 'CHAIN'];

function previewsFor(type, extra = {}) {
  try {
    return svc.previewPromptsForJob({
      confirmedType: type, template: TEMPLATE, presenter: PRESENTER, generateRoseGold: false,
      confirmedCustomerCategory: 'WOMEN', references: { angle45: false, side: false }, ...extra,
    });
  } catch {
    return null; // category not supported by the plan builder
  }
}

describe('hasWhiteStones (real analysis values from production)', () => {
  test('diamonds, CZ and white / clear stones count', () => {
    for (const g of ['DIAMOND', 'Diamonds', 'diamond', 'YELLOW AND WHITE STONES', 'YELLOW AND CLEAR STONES',
      'BLACK AND CLEAR STONES', 'Emerald and Diamonds', 'RUBY AND DIAMONDS', 'YELLOW,SOME_WHITE', 'CZ', 'Cubic Zirconia',
      'Sugar stone', 'GREEN AND WHITE STONES']) {
      assert.equal(svc.hasWhiteStones({ gemstone: g }), true, g);
    }
  });

  test('plain gold, coloured stones and enamel do not', () => {
    for (const g of [null, undefined, '', 'NONE', 'none', 'UNKNOWN', 'RUBY', 'EMERALD', 'BLUE SAPPHIRE', 'GREEN ENAMEL',
      'TURQUOISE', 'BLACK_ONYX', 'PINK TEARDROP', 'YELLOW DIAMOND', 'MULTI-COLOR']) {
      assert.equal(svc.hasWhiteStones({ gemstone: g }), false, String(g));
    }
    assert.equal(svc.hasWhiteStones(null), false);
    assert.equal(svc.hasWhiteStones(undefined), false);
  });
});

describe('prompts', () => {
  test('no white stones: every prompt is byte-identical to before', () => {
    let checked = 0;
    for (const type of TYPES) {
      const before = previewsFor(type);
      if (!before) continue;
      const after = previewsFor(type, { whiteStones: false });
      assert.deepEqual(after.map((p) => p.finalPrompt), before.map((p) => p.finalPrompt), type);
      assert.ok(before.every((p) => !STONE_NOTE.test(p.finalPrompt)), type);
      checked += 1;
    }
    assert.ok(checked >= 4, 'at least four categories checked');
  });

  test('white stones: every shot of every category gets the rule, shown as a locked product rule', () => {
    for (const type of TYPES) {
      const list = previewsFor(type, { whiteStones: true });
      if (!list) continue;
      for (const p of list) {
        assert.match(p.finalPrompt, STONE_NOTE, `${type} ${p.assetType}`);
        assert.ok(p.lockedProductRules.some((r) => STONE_NOTE.test(r)), `${type} ${p.assetType} locked rule`);
      }
      // Only the stone rule is added — nothing else in the prompt changes.
      const plain = previewsFor(type);
      list.forEach((p, i) => {
        assert.equal(p.finalPrompt.replace(` ${svc.WHITE_STONE_FINISH_NOTE}`, ''), plain[i].finalPrompt, `${type} ${p.assetType}`);
      });
    }
  });
});

// --- through the real controllers and the test DB ---------------------------
describe('confirm, preview and regenerate', () => {
  const created = [];
  const originalSend = boss.send;
  let productId;
  let presenterId;

  before(async () => {
    boss.send = async () => 'stub';
    const { rows } = await query(
      `SELECT p.id FROM products p WHERE NOT EXISTS (
         SELECT 1 FROM ai_studio_jobs j WHERE j.product_id = p.id AND j.status NOT IN ('completed', 'failed', 'cancelled')) LIMIT 1`,
    );
    productId = rows[0].id;
    const presenter = await query(
      `INSERT INTO presenters (display_name, style_label, main_preview_image_url, front_portrait_url, face_45_url,
                               side_profile_url, jewellery_placement_url, supported_jewellery_types)
       VALUES ('White Stone Test Presenter', 'Test', 'http://x/p.jpg', 'http://x/f.jpg', 'http://x/45.jpg', 'http://x/s.jpg', 'http://x/j.jpg', ARRAY['BRACELET'])
       RETURNING id`,
    );
    presenterId = presenter.rows[0].id;
  });

  after(async () => {
    boss.send = originalSend;
    if (created.length) await query('DELETE FROM ai_studio_jobs WHERE id = ANY($1)', [created]);
    if (presenterId) await query('DELETE FROM presenters WHERE id = $1', [presenterId]);
  });

  const call = (handler, params, body = {}) =>
    new Promise((resolve) => {
      const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
      handler({ params, body }, res, (err) => resolve({ status: err?.status ?? 500, error: err }));
    });

  async function newJob(analysis) {
    const job = await insertJob({ productId, referenceImageUrls: ['http://x/ref.jpg'] });
    created.push(job.id);
    await query("UPDATE ai_studio_jobs SET status = 'awaiting_confirmation', analysis = $2 WHERE id = $1", [job.id, JSON.stringify(analysis)]);
    return job;
  }
  const close = (id) => query("UPDATE ai_studio_jobs SET status = 'cancelled' WHERE id = $1", [id]);

  test('Aurelia case: diamond bracelet — preview, confirmed prompts and a regenerate all carry the rule', async () => {
    const job = await newJob({ jewelleryType: 'BRACELET', gemstone: 'Diamonds', metalColor: 'YELLOW', wristPieceCount: 1 });
    try {
      const body = { jewelleryType: 'BRACELET', presenterId };
      const preview = await call(previewPrompts, { id: productId, jobId: job.id }, body);
      assert.equal(preview.status, 200, preview.error?.message);
      assert.ok(preview.body.prompts.every((p) => STONE_NOTE.test(p.finalPrompt)));

      const res = await call(confirmJob, { id: productId, jobId: job.id }, body);
      assert.equal(res.status, 202, res.error?.message);
      const assets = await findAssetsByJobId(job.id);
      assert.ok(assets.length > 0);
      for (const a of assets) assert.match(a.assembled_final_prompt, STONE_NOTE, a.asset_type);

      // Bracelet regenerate rebuilds the prompt from current rules.
      await query("UPDATE ai_studio_assets SET status = 'READY', image_key = 'k/x.png' WHERE job_id = $1", [job.id]);
      await query("UPDATE ai_studio_jobs SET status = 'review_ready' WHERE id = $1", [job.id]);
      const first = assets[0];
      await query('UPDATE ai_studio_assets SET assembled_final_prompt = $2 WHERE id = $1', [first.id, 'stale']);
      const retry = await call(retryAsset, { id: productId, jobId: job.id, assetId: first.id });
      assert.equal(retry.status, 202, retry.error?.message);
      const after = (await findAssetsByJobId(job.id)).find((a) => a.id === first.id);
      assert.match(after.assembled_final_prompt, STONE_NOTE);
    } finally {
      await close(job.id);
    }
  });

  test('plain gold bracelet: no stone rule anywhere', async () => {
    const job = await newJob({ jewelleryType: 'BRACELET', gemstone: null, metalColor: 'YELLOW', wristPieceCount: 1 });
    try {
      const res = await call(confirmJob, { id: productId, jobId: job.id }, { jewelleryType: 'BRACELET', presenterId });
      assert.equal(res.status, 202, res.error?.message);
      const assets = await findAssetsByJobId(job.id);
      assert.ok(assets.length > 0);
      for (const a of assets) assert.doesNotMatch(a.assembled_final_prompt, STONE_NOTE, a.asset_type);
    } finally {
      await close(job.id);
    }
  });
});
