// Bangle: the admin confirms the bangle set (single / identical pair / two
// different designs) on Analyse & Confirm instead of the job silently using
// the AI's own count. Production, Lucy Gold Bangle, 20 Nov 2026: the
// reference showed two identical bangles next to a printed five-line size
// list; the AI counted 3 pieces and "not a pair", so the job skipped the pair
// rules and produced stacks of 3 and rows of 5 pairs. Also: every prompt,
// the analysis and the validator now ignore printed text on the reference.
// OpenAI is replaced by a fetch stub and the queue is stubbed — nothing here
// makes a network or paid call.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.OPENAI_API_KEY = 'sk-test';
process.env.OPENAI_VISION_MODEL = 'vision-test';
process.env.OPENAI_IMAGE_MODEL = 'image-test';

const svc = await import('../../src/services/aiStudioService.js');
const { TEMPLATE, PRESENTER } = await import('./helpers/promptHashes.mjs');
const { query } = await import('../../src/config/db.js');
const { boss } = await import('../../src/jobs/queue.js');
const { insertJob, findAssetsByJobId, findJobById } = await import('../../src/repositories/aiStudio.repository.js');
const { confirmJob, previewPrompts, retryAsset } = await import('../../src/controllers/aiStudio.controller.js');

const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push(JSON.parse(init.body));
  return new Response(
    JSON.stringify({
      id: 'x', object: 'chat.completion', created: 0, model: 'v',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '{}', refusal: null } }],
    }),
    { headers: { 'content-type': 'application/json' } },
  );
};
beforeEach(() => {
  calls.length = 0;
});

const LUCY = { jewelleryType: 'BANGLE', wristPieceCount: 3, bangleSetType: 'NOT_APPLICABLE' };
const IDENTICAL = /The second identical bangle is added afterwards by the system/;
const DISTINCT = /two reference bangles have DIFFERENT designs/;
const TEXT_NOTE = /ignore all of it completely\. It is not part of the jewellery/;

function previews(bangleQuantity, bangleSetType) {
  return svc.previewPromptsForJob({
    confirmedType: 'BANGLE', template: TEMPLATE, presenter: PRESENTER, generateRoseGold: false,
    references: { angle45: false, side: false }, bangleQuantity, bangleSetType,
  });
}

describe('helpers', () => {
  test('AI suggestion as a choice: only a count of 1 or 2 pre-fills', () => {
    assert.equal(svc.bangleSetChoiceSuggestion({ wristPieceCount: 1 }), 'SINGLE');
    assert.equal(svc.bangleSetChoiceSuggestion({ wristPieceCount: 2, bangleSetType: 'IDENTICAL_PAIR' }), 'IDENTICAL_PAIR');
    assert.equal(svc.bangleSetChoiceSuggestion(JSON.stringify({ wristPieceCount: 2, bangleSetType: 'DISTINCT_PAIR' })), 'DISTINCT_PAIR');
    assert.equal(svc.bangleSetChoiceSuggestion(LUCY), null, '3 pieces: admin must choose');
    assert.equal(svc.bangleSetChoiceSuggestion({ wristPieceCount: 2, bangleSetType: 'NOT_APPLICABLE' }), null);
    assert.equal(svc.bangleSetChoiceSuggestion({}), null, 'older analysis');
  });

  test('a confirmed choice overrides the AI count; no choice keeps the old behaviour', () => {
    assert.equal(svc.bangleQuantityForJob('BANGLE', LUCY, 'IDENTICAL_PAIR'), 'TWO_BANGLE_SET');
    assert.equal(svc.bangleSetTypeForJob('BANGLE', LUCY, 'IDENTICAL_PAIR'), 'IDENTICAL_PAIR');
    assert.equal(svc.bangleQuantityForJob('BANGLE', LUCY, 'DISTINCT_PAIR'), 'TWO_BANGLE_SET');
    assert.equal(svc.bangleSetTypeForJob('BANGLE', LUCY, 'DISTINCT_PAIR'), 'DISTINCT_PAIR');
    const pairAnalysis = { wristPieceCount: 2, bangleSetType: 'IDENTICAL_PAIR' };
    assert.equal(svc.bangleQuantityForJob('BANGLE', pairAnalysis, 'SINGLE'), 'SINGLE_BANGLE');
    assert.equal(svc.bangleSetTypeForJob('BANGLE', pairAnalysis, 'SINGLE'), null);
    // No choice (older jobs): exactly as before.
    assert.equal(svc.bangleQuantityForJob('BANGLE', LUCY), null);
    assert.equal(svc.bangleQuantityForJob('BANGLE', pairAnalysis), 'TWO_BANGLE_SET');
    assert.equal(svc.bangleSetTypeForJob('BANGLE', pairAnalysis), 'IDENTICAL_PAIR');
    // Other categories never get a bangle quantity.
    assert.equal(svc.bangleQuantityForJob('BRACELET', pairAnalysis, 'IDENTICAL_PAIR'), null);
    assert.equal(svc.bangleSetTypeForJob('BRACELET', pairAnalysis, 'IDENTICAL_PAIR'), null);
    assert.equal(svc.bangleSetChoiceForJob({ jewellery_type: 'BANGLE', bangle_set_type: 'SINGLE' }), 'SINGLE');
    assert.equal(svc.bangleSetChoiceForJob({ jewellery_type: 'BANGLE', bangle_set_type: null }), null);
    assert.equal(svc.bangleSetChoiceForJob({ jewellery_type: 'RING', bangle_set_type: 'SINGLE' }), null);
  });
});

describe('ignore printed text on the reference', () => {
  test('analysis request tells the AI to ignore sizes, design numbers and labels when counting', async () => {
    await svc.analyseJewellery(Buffer.from('x'), 'image/jpeg').catch(() => {});
    assert.equal(calls.length, 1);
    assert.match(calls[0].messages[0].content, /Ignore any text printed on the photo \(design numbers, size lists/);
    assert.match(calls[0].messages[0].content, /must never be used to decide the type, the count or the set/);
  });

  test('every generation prompt of every category carries the note', () => {
    for (const type of svc.JEWELLERY_TYPES) {
      let list;
      try {
        list = svc.previewPromptsForJob({
          confirmedType: type, template: TEMPLATE, presenter: PRESENTER, generateRoseGold: false,
          confirmedCustomerCategory: 'WOMEN', references: { angle45: false, side: false },
        });
      } catch {
        continue;
      }
      for (const p of list) assert.match(p.finalPrompt, TEXT_NOTE, `${type} ${p.assetType}`);
    }
  });

  test('validation compares the jewellery only', () => {
    const text = svc.buildValidationText({ confirmedType: 'BANGLE', metalColor: 'YELLOW', assetType: 'YELLOW_FRONT' });
    assert.match(text, /Ignore any text, numbers, labels or watermarks printed on the reference image — compare the jewellery only\./);
  });
});

describe('prompts follow the confirmed set', () => {
  test('Lucy case: AI saw 3, admin confirms identical pair → the pair-composite prompts', () => {
    const choice = 'IDENTICAL_PAIR';
    const list = previews(svc.bangleQuantityForJob('BANGLE', LUCY, choice), svc.bangleSetTypeForJob('BANGLE', LUCY, choice));
    const pairList = previews('TWO_BANGLE_SET', 'IDENTICAL_PAIR');
    assert.deepEqual(list.map((p) => p.finalPrompt), pairList.map((p) => p.finalPrompt));
    assert.ok(list.filter((p) => p.kind === 'catalogue').every((p) => IDENTICAL.test(p.finalPrompt)));
    // Without the choice the job would have fallen back to the neutral wording.
    assert.ok(previews(svc.bangleQuantityForJob('BANGLE', LUCY), null).every((p) => !IDENTICAL.test(p.finalPrompt)));
  });

  test('distinct pair and single follow the choice too', () => {
    const distinct = previews(svc.bangleQuantityForJob('BANGLE', LUCY, 'DISTINCT_PAIR'), svc.bangleSetTypeForJob('BANGLE', LUCY, 'DISTINCT_PAIR'));
    assert.ok(distinct.some((p) => DISTINCT.test(p.finalPrompt)));
    const single = previews(svc.bangleQuantityForJob('BANGLE', LUCY, 'SINGLE'), svc.bangleSetTypeForJob('BANGLE', LUCY, 'SINGLE'));
    assert.deepEqual(single.map((p) => p.finalPrompt), previews('SINGLE_BANGLE', null).map((p) => p.finalPrompt));
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
       VALUES ('Bangle Set Test Presenter', 'Test', 'http://x/p.jpg', 'http://x/f.jpg', 'http://x/45.jpg', 'http://x/s.jpg', 'http://x/j.jpg', ARRAY['BANGLE'])
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

  test('Lucy case through the API: choice saved, used for prompts and kept on regenerate', async () => {
    const job = await newJob(LUCY);
    try {
      const body = { jewelleryType: 'BANGLE', presenterId, bangleSetType: 'IDENTICAL_PAIR' };
      const preview = await call(previewPrompts, { id: productId, jobId: job.id }, body);
      assert.equal(preview.status, 200, preview.error?.message);
      assert.ok(preview.body.prompts.filter((p) => p.kind === 'catalogue').every((p) => IDENTICAL.test(p.finalPrompt)));

      const res = await call(confirmJob, { id: productId, jobId: job.id }, body);
      assert.equal(res.status, 202, res.error?.message);
      assert.equal((await findJobById(job.id)).bangle_set_type, 'IDENTICAL_PAIR');
      const assets = await findAssetsByJobId(job.id);
      assert.equal(assets.length, 6);
      for (const a of assets.filter((x) => !x.asset_type.startsWith('PRESENTER_'))) {
        assert.match(a.assembled_final_prompt, IDENTICAL, a.asset_type);
        assert.match(a.assembled_final_prompt, TEXT_NOTE, a.asset_type);
      }

      // Bangle regenerate rebuilds the prompt from current rules — it must
      // keep the confirmed pair, not fall back to the AI's 3.
      await query("UPDATE ai_studio_assets SET status = 'READY', image_key = 'k/x.png' WHERE job_id = $1", [job.id]);
      await query("UPDATE ai_studio_jobs SET status = 'review_ready' WHERE id = $1", [job.id]);
      const front = assets.find((a) => a.asset_type === 'YELLOW_FRONT');
      await query('UPDATE ai_studio_assets SET assembled_final_prompt = $2 WHERE id = $1', [front.id, 'stale']);
      const retry = await call(retryAsset, { id: productId, jobId: job.id, assetId: front.id });
      assert.equal(retry.status, 202, retry.error?.message);
      const after = (await findAssetsByJobId(job.id)).find((a) => a.id === front.id);
      assert.match(after.assembled_final_prompt, IDENTICAL);
    } finally {
      await close(job.id);
    }
  });

  test('no choice sent: AI suggestion used when it counted 1 or 2; null (old behaviour) otherwise', async () => {
    // One active job per product — run the two cases one after the other.
    const pair = await newJob({ jewelleryType: 'BANGLE', wristPieceCount: 2, bangleSetType: 'DISTINCT_PAIR' });
    try {
      const a = await call(confirmJob, { id: productId, jobId: pair.id }, { jewelleryType: 'BANGLE', presenterId });
      assert.equal(a.status, 202, a.error?.message);
      assert.equal((await findJobById(pair.id)).bangle_set_type, 'DISTINCT_PAIR');
    } finally {
      await close(pair.id);
    }
    const lucy = await newJob(LUCY);
    try {
      const b = await call(confirmJob, { id: productId, jobId: lucy.id }, { jewelleryType: 'BANGLE', presenterId });
      assert.equal(b.status, 202, b.error?.message);
      assert.equal((await findJobById(lucy.id)).bangle_set_type, null);
    } finally {
      await close(lucy.id);
    }
  });

  test('other categories never store a bangle set', async () => {
    const job = await newJob({ jewelleryType: 'BRACELET', wristPieceCount: 2, bangleSetType: 'IDENTICAL_PAIR' });
    try {
      const res = await call(confirmJob, { id: productId, jobId: job.id }, { jewelleryType: 'BRACELET', presenterId: null, bangleSetType: 'IDENTICAL_PAIR' });
      if (res.status === 202) assert.equal((await findJobById(job.id)).bangle_set_type, null);
    } finally {
      await close(job.id);
    }
  });
});
