// Necklace: necklace only vs necklace + matching earrings set. The AI
// suggests it in the existing analysis call, the admin confirms it, and a
// confirmed necklace-only product gets a plain "no earrings, bare ears" rule
// on presenter images (production, Fine Trace necklace, 16 Nov 2026: the
// model kept adding studs copying the necklace motif). Sets and older jobs
// keep today's prompts exactly. OpenAI is replaced by a fetch stub and the
// queue is stubbed — nothing here makes a network or paid call.
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
  const body = JSON.parse(init.body);
  calls.push(body);
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

const BARE = /This product is a necklace only — the uploaded reference contains no earrings\. The presenter wears no earrings: both ears are completely bare/;
function previews(type, necklaceSetType, opts = {}) {
  return svc.previewPromptsForJob({
    confirmedType: type, template: TEMPLATE, presenter: PRESENTER, generateRoseGold: opts.rose ?? false,
    confirmedCustomerCategory: opts.customer, references: { angle45: false, side: false }, necklaceSetType,
  });
}

describe('analysis', () => {
  test('the one analysis request asks for necklaceSetType', async () => {
    await svc.analyseJewellery(Buffer.from('x'), 'image/jpeg').catch(() => {});
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].response_format.json_schema.schema.properties.necklaceSetType.enum, ['NECKLACE_ONLY', 'NECKLACE_SET', 'NOT_APPLICABLE']);
    assert.match(calls[0].messages[0].content, /NECKLACE_ONLY when the photo shows a necklace with no earrings, NECKLACE_SET when it shows a necklace together with matching earrings/);
  });

  test('suggestion and confirmed value helpers', () => {
    assert.equal(svc.necklaceSetTypeSuggestion({ necklaceSetType: 'NECKLACE_ONLY' }), 'NECKLACE_ONLY');
    assert.equal(svc.necklaceSetTypeSuggestion(JSON.stringify({ necklaceSetType: 'NECKLACE_SET' })), 'NECKLACE_SET');
    assert.equal(svc.necklaceSetTypeSuggestion({ necklaceSetType: 'NOT_APPLICABLE' }), null);
    assert.equal(svc.necklaceSetTypeSuggestion({}), null, 'older analysis');
    assert.equal(svc.necklaceSetTypeForJob({ jewellery_type: 'NECKLACE', necklace_set_type: 'NECKLACE_ONLY' }), 'NECKLACE_ONLY');
    assert.equal(svc.necklaceSetTypeForJob({ jewellery_type: 'NECKLACE', necklace_set_type: null }), null, 'older job');
    assert.equal(svc.necklaceSetTypeForJob({ jewellery_type: 'PENDANT', necklace_set_type: 'NECKLACE_ONLY' }), null);
  });
});

describe('prompts', () => {
  test('necklace only: presenter prompts say bare ears and never mention matching earrings; catalogue prompts unchanged', () => {
    for (const rose of [false, true]) {
      for (const customer of [undefined, 'WOMEN', 'GENTS', 'KIDS', 'UNISEX']) {
        let only;
        let unknown;
        try {
          only = previews('NECKLACE', 'NECKLACE_ONLY', { rose, customer });
          unknown = previews('NECKLACE', undefined, { rose, customer });
        } catch {
          continue; // combination needs a presenter choice the preview cannot make
        }
        only.forEach((p, i) => {
          if (p.kind === 'catalogue') {
            assert.equal(p.finalPrompt, unknown[i].finalPrompt, `${p.assetType} catalogue unchanged`);
          } else {
            assert.match(p.finalPrompt, BARE, p.assetType);
            assert.match(p.finalPrompt, /never create earrings that copy the necklace motif/);
            assert.match(p.finalPrompt, /No earrings of any kind — both ears bare/);
            assert.doesNotMatch(p.finalPrompt, /matching earrings|stud earrings|sitting flat directly on the earlobe/, p.assetType);
          }
        });
      }
    }
  });

  test('necklace set and older jobs: prompts exactly as today', () => {
    for (const rose of [false, true]) {
      const set = previews('NECKLACE', 'NECKLACE_SET', { rose });
      const unknown = previews('NECKLACE', undefined, { rose });
      assert.deepEqual(set.map((p) => p.finalPrompt), unknown.map((p) => p.finalPrompt));
      for (const p of set.filter((x) => x.kind === 'presenter')) {
        assert.match(p.finalPrompt, /the presenter must wear both, the necklace on the neck and the matching earrings on both ears/);
        assert.doesNotMatch(p.finalPrompt, BARE);
      }
    }
  });

  test('every other category is unchanged even if a necklace set type is passed', () => {
    for (const type of svc.JEWELLERY_TYPES.filter((t) => t !== 'NECKLACE')) {
      for (const st of ['NECKLACE_ONLY', 'NECKLACE_SET']) {
        assert.deepEqual(previews(type, st).map((p) => p.finalPrompt), previews(type, undefined).map((p) => p.finalPrompt), `${type} ${st}`);
      }
    }
  });

  test('validation: necklace only adds an explicit "any earring fails" note; set / older / other categories unchanged', () => {
    const text = (type, st, assetType = 'PRESENTER_YELLOW_1') =>
      svc.buildValidationText({ confirmedType: type, metalColor: 'YELLOW', assetType, necklaceSetType: st });
    assert.match(text('NECKLACE', 'NECKLACE_ONLY'), /The admin confirmed this product is a necklace only, with no earrings: set validationStatus to "failed" if any earring is visible/);
    assert.equal(text('NECKLACE', 'NECKLACE_SET'), text('NECKLACE', undefined));
    for (const type of ['PENDANT', 'EARRINGS', 'RING', 'BANGLE']) assert.equal(text(type, 'NECKLACE_ONLY'), text(type, undefined), type);
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
       VALUES ('Necklace Test Presenter', 'Test', 'http://x/p.jpg', 'http://x/f.jpg', 'http://x/45.jpg', 'http://x/s.jpg', 'http://x/j.jpg', ARRAY['NECKLACE','PENDANT'])
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

  test('admin choice is saved and used; it overrides the AI suggestion', async () => {
    const job = await newJob({ jewelleryType: 'NECKLACE', necklaceSetType: 'NECKLACE_SET' });
    try {
      const preview = await call(previewPrompts, { id: productId, jobId: job.id }, { jewelleryType: 'NECKLACE', presenterId, necklaceSetType: 'NECKLACE_ONLY' });
      assert.equal(preview.status, 200, preview.error?.message);
      assert.ok(preview.body.prompts.filter((p) => p.kind === 'presenter').every((p) => BARE.test(p.finalPrompt)));
      const res = await call(confirmJob, { id: productId, jobId: job.id }, { jewelleryType: 'NECKLACE', presenterId, necklaceSetType: 'NECKLACE_ONLY' });
      assert.equal(res.status, 202, res.error?.message);
      assert.equal((await findJobById(job.id)).necklace_set_type, 'NECKLACE_ONLY');
      const assets = await findAssetsByJobId(job.id);
      assert.equal(assets.length, 6);
      for (const a of assets) {
        if (a.asset_type.startsWith('PRESENTER_')) assert.match(a.assembled_final_prompt, BARE, a.asset_type);
        else assert.doesNotMatch(a.assembled_final_prompt, BARE, a.asset_type);
      }
      // Regenerate keeps the confirmed choice (refresh is Bracelet/Bangle only,
      // so the stored prompt is reused; the generation job reads the same value).
      await query("UPDATE ai_studio_assets SET status = 'READY', image_key = 'k/x.png' WHERE job_id = $1", [job.id]);
      await query("UPDATE ai_studio_jobs SET status = 'review_ready' WHERE id = $1", [job.id]);
      const presenter1 = assets.find((a) => a.asset_type === 'PRESENTER_YELLOW_1');
      const retry = await call(retryAsset, { id: productId, jobId: job.id, assetId: presenter1.id });
      assert.equal(retry.status, 202, retry.error?.message);
      const after = (await findAssetsByJobId(job.id)).find((a) => a.id === presenter1.id);
      assert.match(after.assembled_final_prompt, BARE);
      assert.equal(svc.necklaceSetTypeForJob(await findJobById(job.id)), 'NECKLACE_ONLY');
    } finally {
      await close(job.id);
    }
  });

  test('no admin choice sent: the AI suggestion is used', async () => {
    const job = await newJob({ jewelleryType: 'NECKLACE', necklaceSetType: 'NECKLACE_ONLY' });
    try {
      const res = await call(confirmJob, { id: productId, jobId: job.id }, { jewelleryType: 'NECKLACE', presenterId });
      assert.equal(res.status, 202, res.error?.message);
      assert.equal((await findJobById(job.id)).necklace_set_type, 'NECKLACE_ONLY');
    } finally {
      await close(job.id);
    }
  });

  test('older analysis without the field, and non-Necklace jobs, store nothing and keep today\'s prompts', async () => {
    const older = await newJob({ jewelleryType: 'NECKLACE' });
    try {
      await call(confirmJob, { id: productId, jobId: older.id }, { jewelleryType: 'NECKLACE', presenterId });
      assert.equal((await findJobById(older.id)).necklace_set_type, null);
      const assets = await findAssetsByJobId(older.id);
      for (const a of assets.filter((x) => x.asset_type.startsWith('PRESENTER_'))) {
        assert.doesNotMatch(a.assembled_final_prompt, BARE);
        assert.match(a.assembled_final_prompt, /the presenter must wear both, the necklace on the neck and the matching earrings/);
      }
    } finally {
      await close(older.id);
    }
    const pendant = await newJob({ jewelleryType: 'PENDANT', necklaceSetType: 'NECKLACE_ONLY' });
    try {
      const res = await call(confirmJob, { id: productId, jobId: pendant.id }, { jewelleryType: 'PENDANT', presenterId, necklaceSetType: 'NECKLACE_ONLY' });
      assert.equal(res.status, 202, res.error?.message);
      assert.equal((await findJobById(pendant.id)).necklace_set_type, null);
    } finally {
      await close(pendant.id);
    }
  });
});

// --- Necklace catalogue: four fixed shots ------------------------------------
// Local job c05036b9 (16 Nov 2026): all four catalogue images came out as the
// same flat U at different zooms — Images 2 and 3 both asked for a small
// 15–25° turn. Each slot now has its own camera position.
describe('necklace catalogue shots', () => {
  const SHOTS = [/FRONT CATALOGUE VIEW: the complete necklace laid flat/, /HERO THREE-QUARTER VIEW: .*rotate the necklace approximately 40 degrees.*15–20 degrees above the surface/, /LOW SIDE DETAIL VIEW: the camera close to the surface/, /MACRO DETAIL VIEW: a genuine close-up of the necklace's main motif/];
  const shotOf = (p) => SHOTS.findIndex((re) => re.test(p.finalPrompt));
  const necklaceJobs = () => {
    const jobs = [];
    for (const rose of [false, true]) {
      for (const references of [{ angle45: false, side: false }, { angle45: true, side: false }, { angle45: false, side: true }, { angle45: true, side: true }]) {
        for (const st of [undefined, 'NECKLACE_ONLY', 'NECKLACE_SET']) {
          jobs.push(
            svc.previewPromptsForJob({ confirmedType: 'NECKLACE', template: TEMPLATE, presenter: PRESENTER, generateRoseGold: rose, references, necklaceSetType: st }),
          );
        }
      }
    }
    return jobs;
  };

  test('every catalogue slot gets its own distinct shot; the old small-turn wording is gone', () => {
    for (const job of necklaceJobs()) {
      const cat = job.filter((p) => p.kind === 'catalogue');
      assert.equal(cat.length, 4);
      for (const p of cat) {
        assert.ok(shotOf(p) >= 0, p.assetType);
        assert.doesNotMatch(p.finalPrompt, /rotate it only slightly, approximately 15–25 degrees|camera moved only slightly/, p.assetType);
        assert.match(p.finalPrompt, /must never differ only by zoom/);
        assert.match(p.finalPrompt, /Never show or invent the reverse side of the necklace or its motif/);
        assert.match(p.finalPrompt, /seamless, pure white \(#FFFFFF\) studio background/);
      }
      // Rose Gold OFF: four different shots; ON: Front + Hero for each metal.
      const kinds = cat.map(shotOf);
      if (job.some((p) => p.assetType.startsWith('ROSE_'))) assert.deepEqual(kinds, [0, 1, 0, 1]);
      else assert.deepEqual(kinds, [0, 1, 2, 3]);
    }
  });

  test('catalogue keeps the set / no-earrings, hidden-clasp and no-person rules; presenter prompts are untouched by the shots', () => {
    const only = previews('NECKLACE', 'NECKLACE_ONLY');
    for (const p of only.filter((x) => x.kind === 'catalogue')) {
      assert.match(p.finalPrompt, /If the reference shows only a necklace, do not add any earrings/);
      assert.match(p.finalPrompt, /clasp/i);
      assert.match(p.finalPrompt, /do not include any person, model, mannequin/);
    }
    for (const p of only.filter((x) => x.kind === 'presenter')) assert.doesNotMatch(p.finalPrompt, /HERO THREE-QUARTER VIEW|LOW SIDE DETAIL VIEW/);
  });

  test('the reviewer checks each necklace catalogue image against its own shot; other categories keep their view notes', () => {
    const text = (type, assetType) => svc.buildValidationText({ confirmedType: type, metalColor: 'YELLOW', assetType });
    assert.match(text('NECKLACE', 'YELLOW_SLIGHT_ANGLE'), /Necklace HERO THREE-QUARTER view/);
    assert.match(text('NECKLACE', 'YELLOW_HERO_45'), /Necklace HERO THREE-QUARTER view/);
    assert.match(text('NECKLACE', 'YELLOW_SIDE'), /Necklace LOW SIDE DETAIL view/);
    assert.doesNotMatch(text('NECKLACE', 'YELLOW_SIDE'), /genuine side profile/);
    assert.match(text('NECKLACE', 'YELLOW_MACRO'), /Necklace MACRO DETAIL view/);
    assert.match(text('PENDANT', 'YELLOW_SIDE'), /This is the SIDE-PROFILE VIEW/);
    assert.match(text('EARRINGS', 'YELLOW_MACRO'), /This is the MACRO DETAIL VIEW/);
  });
});
