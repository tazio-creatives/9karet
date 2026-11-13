import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../src/config/db.js';
import { boss } from '../../src/jobs/queue.js';
import {
  referenceRolesFor,
  referenceAvailability,
  buildJobPlan,
  previewPromptsForJob,
  buildGenerationRequest,
} from '../../src/services/aiStudioService.js';
import sharp from 'sharp';
import { confirmJob, createJob, parseReferenceRoles } from '../../src/controllers/aiStudio.controller.js';
import { storageProvider } from '../../src/providers/storage/index.js';
import { keyFromUrl } from '../../src/utils/storageKey.js';
import { insertJob, findAssetsByJobId, findJobById } from '../../src/repositories/aiStudio.repository.js';

// Reference roles (main/front required; 45° and side optional) and how they
// pick each catalogue slot's view and references. Older jobs (no roles in
// their keys) keep the original behaviour — see aiStudio.test.js.

const BASE = 'https://bucket/products/ai-studio/p1/references';
const MAIN = `${BASE}/a-main_front.jpeg`;
const ANGLE = `${BASE}/b-angle_45.jpeg`;
const SIDE = `${BASE}/c-side_profile.jpeg`;
const TEMPLATE = { front_prompt: 'FRONT_PROMPT', hero_45_prompt: 'HERO', presenter_placement: 'wrist shot', presenter_crop: 'portrait 4:5' };
const PRESENTER = { id: '00000000-0000-4000-8000-0000000000aa', prompt_descriptor: 'a presenter', style_label: 'Studio' };

const COMBOS = {
  'main only': [MAIN],
  'main + 45°': [MAIN, ANGLE],
  'main + side': [MAIN, SIDE],
  'all three': [MAIN, ANGLE, SIDE],
};

const plan = (urls, confirmedType, generateRoseGold = false) =>
  buildJobPlan({
    jewelleryCategory: confirmedType,
    generateRoseGold,
    customerCategory: 'WOMEN',
    selectedPresenter: PRESENTER,
    references: referenceAvailability(urls),
  });
const previews = (urls, confirmedType, generateRoseGold = false) =>
  previewPromptsForJob({
    confirmedType,
    template: TEMPLATE,
    presenter: PRESENTER,
    generateRoseGold,
    confirmedCustomerCategory: 'WOMEN',
    references: referenceAvailability(urls),
  });

describe('reference roles', () => {
  test('roles come from the stored key; older jobs fall back to first = main', () => {
    assert.deepEqual(referenceRolesFor([MAIN, SIDE]), { main_front: MAIN, angle_45: null, side_profile: SIDE, roleTagged: true });
    assert.deepEqual(referenceRolesFor([`${BASE}/x.jpeg`, `${BASE}/y.jpeg`]), {
      main_front: `${BASE}/x.jpeg`,
      angle_45: null,
      side_profile: null,
      roleTagged: false,
    });
  });

  test('upload roles: main required, no duplicates, one per file; absent = old behaviour', () => {
    assert.equal(parseReferenceRoles(undefined, 2), null);
    assert.deepEqual(parseReferenceRoles(['main_front', 'side_profile'], 2), ['main_front', 'side_profile']);
    assert.deepEqual(parseReferenceRoles('main_front,angle_45', 2), ['main_front', 'angle_45']);
    assert.throws(() => parseReferenceRoles(['angle_45'], 1), /main\/front reference image is required/);
    assert.throws(() => parseReferenceRoles(['main_front', 'main_front'], 2), /only be used once/);
    assert.throws(() => parseReferenceRoles(['main_front'], 2), /needs a role/);
    assert.throws(() => parseReferenceRoles(['main_front', 'back'], 2), /Unknown reference image role/);
  });
});

describe('catalogue views by reference count', () => {
  const views = (urls, type) => plan(urls, type).slice(0, 4).map((m) => `${m.view}<${m.references.geometry}>`);

  test('main only: front, safe 15–25° angle, elevated detail, macro — all from the main reference', () => {
    assert.deepEqual(views(COMBOS['main only'], 'BRACELET'), [
      'FRONT<main_front>',
      'SLIGHT_ANGLE<main_front>',
      'ELEVATED_DETAIL<main_front>',
      'MACRO<main_front>',
    ]);
  });

  test('main + 45°: hero uses the 45° reference; no strict side view; detail view also sees the 45° reference', () => {
    const p = plan(COMBOS['main + 45°'], 'BRACELET');
    assert.deepEqual(views(COMBOS['main + 45°'], 'BRACELET'), [
      'FRONT<main_front>',
      'HERO_45<angle_45>',
      'ELEVATED_DETAIL<main_front>',
      'MACRO<main_front>',
    ]);
    assert.deepEqual(p[2].references.supporting, ['angle_45']);
  });

  test('main + side: safe angle from main; side view uses the side reference', () => {
    assert.deepEqual(views(COMBOS['main + side'], 'BRACELET'), [
      'FRONT<main_front>',
      'SLIGHT_ANGLE<main_front>',
      'SIDE_PROFILE<side_profile>',
      'MACRO<main_front>',
    ]);
  });

  test('all three: front ← main, hero ← 45°, side ← side, macro ← main (clearest design view)', () => {
    assert.deepEqual(views(COMBOS['all three'], 'BRACELET'), [
      'FRONT<main_front>',
      'HERO_45<angle_45>',
      'SIDE_PROFILE<side_profile>',
      'MACRO<main_front>',
    ]);
  });

  test('Ring keeps its angled view first (its primary image) and the same reference rules', () => {
    assert.deepEqual(views(COMBOS['main only'], 'RING'), [
      'SLIGHT_ANGLE<main_front>',
      'FRONT_TOP<main_front>',
      'ELEVATED_DETAIL<main_front>',
      'MACRO<main_front>',
    ]);
    assert.deepEqual(views(COMBOS['all three'], 'RING'), [
      'HERO<angle_45>',
      'FRONT_TOP<main_front>',
      'SIDE_PROFILE<side_profile>',
      'MACRO<main_front>',
    ]);
  });

  test('six-image output is unchanged for every combination, category and Rose Gold mode', () => {
    for (const urls of Object.values(COMBOS)) {
      for (const type of ['RING', 'NECKLACE', 'EARRINGS']) {
        for (const rose of [false, true]) {
          const p = plan(urls, type, rose);
          const shape = p.map((m) => `${m.slotKey}:${m.kind}:${m.metal}`);
          const expected = rose
            ? ['yellow_catalogue_1:catalogue:YELLOW', 'yellow_catalogue_2:catalogue:YELLOW', 'rose_catalogue_1:catalogue:ROSE', 'rose_catalogue_2:catalogue:ROSE', 'yellow_presenter_1:presenter:YELLOW', 'rose_presenter_1:presenter:ROSE']
            : ['yellow_catalogue_1:catalogue:YELLOW', 'yellow_catalogue_2:catalogue:YELLOW', 'yellow_catalogue_3:catalogue:YELLOW', 'yellow_catalogue_4:catalogue:YELLOW', 'yellow_presenter_1:presenter:YELLOW', 'yellow_presenter_2:presenter:YELLOW'];
          assert.deepEqual(shape, expected, `${type} ${rose}`);
          if (rose) assert.equal(p[2].view, p[0].view, 'rose views repeat the yellow views');
        }
      }
    }
  });
});

describe('catalogue prompts by reference count', () => {
  test('no side reference: no strict side profile is requested; the elevated detail wording is used', () => {
    for (const combo of ['main only', 'main + 45°']) {
      const p = previews(COMBOS[combo], 'NECKLACE');
      for (const c of p.slice(0, 4)) assert.doesNotMatch(c.finalPrompt, /^.*Side-profile view\./m, `${combo} ${c.slotKey}`);
      assert.match(p[2].finalPrompt, /Create a reference-faithful elevated detail view of the exact uploaded jewellery/);
      assert.match(p[2].finalPrompt, /If a structural detail is not clearly visible in the uploaded reference, do not invent it/);
    }
  });

  test('no 45° reference: the angled slot is a slight 15–25° turn of the main reference', () => {
    const p = previews(COMBOS['main + side'], 'NECKLACE');
    assert.match(p[1].finalPrompt, /rotated approximately 15–25 degrees/);
    assert.match(p[2].finalPrompt, /Side-profile view/);
  });

  test('the product-reproduction rule is on every catalogue prompt and on no presenter prompt', () => {
    for (const urls of Object.values(COMBOS)) {
      const p = previews(urls, 'EARRINGS');
      for (const c of p.slice(0, 4)) assert.match(c.finalPrompt, /This is a product-reproduction task, not a jewellery-design task/);
      for (const c of p.slice(4)) assert.doesNotMatch(c.finalPrompt, /product-reproduction task/);
    }
  });

  test('prompts say which attached image is which', () => {
    const p = previews(COMBOS['all three'], 'BRACELET');
    assert.match(p[1].finalPrompt, /attached image 2 is the 45° angled reference/);
    assert.match(p[2].finalPrompt, /attached image 2 is the side-profile reference/);
    assert.match(p[0].finalPrompt, /The attached image is the main\/front reference/);
  });

  test('requests: main reference first, then the view reference; presenter requests unchanged', () => {
    const main = { buffer: Buffer.from('main'), mimetype: 'image/jpeg', filename: 'reference.jpg' };
    const p = plan(COMBOS['all three'], 'BRACELET');
    const hero = buildGenerationRequest({
      outputSlot: p[1],
      jewelleryReference: main,
      viewReferences: [{ role: 'angle_45', buffer: Buffer.from('angle') }],
      prompt: 'x',
    });
    assert.deepEqual(hero.images.map((i) => i.role), ['jewellery', 'angle_45']);
    assert.equal(hero.images[0].buffer, main.buffer);
    const presenter = buildGenerationRequest({
      outputSlot: p[4],
      jewelleryReference: main,
      presenterReference: { buffer: Buffer.from('photo') },
      viewReferences: [{ role: 'angle_45', buffer: Buffer.from('angle') }],
      prompt: 'x',
    });
    assert.deepEqual(presenter.images.map((i) => i.role), ['jewellery', 'presenter']);
  });

  test('older jobs (no reference info) keep the original prompts — no reproduction rule, original views', () => {
    const old = previewPromptsForJob({ confirmedType: 'NECKLACE', template: TEMPLATE, presenter: PRESENTER, generateRoseGold: false });
    assert.deepEqual(old.slice(0, 4).map((c) => c.assetType), ['YELLOW_FRONT', 'YELLOW_HERO_45', 'YELLOW_SIDE', 'YELLOW_MACRO']);
    for (const c of old) assert.doesNotMatch(c.finalPrompt, /product-reproduction task/);
  });
});

// Through the real confirm endpoint and database (queue stubbed — no OpenAI).
describe('confirm with role-tagged references', () => {
  const originalSend = boss.send;
  const created = [];
  let productId;

  before(async () => {
    boss.send = async () => 'stub';
    const { rows } = await query(
      `SELECT p.id FROM products p WHERE NOT EXISTS (
         SELECT 1 FROM ai_studio_jobs j WHERE j.product_id = p.id AND j.status NOT IN ('completed','failed','cancelled'))
       LIMIT 1`,
    );
    productId = rows[0].id;
  });

  after(async () => {
    boss.send = originalSend;
    if (created.length) await query('DELETE FROM ai_studio_jobs WHERE id = ANY($1)', [created]);
  });

  function confirm(jobId, body) {
    return new Promise((resolve) => {
      const res = { status: (c) => ({ json: (b) => resolve({ status: c, body: b }) }), json: (b) => resolve({ status: 200, body: b }) };
      confirmJob({ params: { id: productId, jobId }, body }, res, (err) => resolve({ status: err?.status ?? 500, error: err }));
    });
  }

  test('upload: each image is stored with its role in the key, main/front first, whatever the upload order', async () => {
    const png = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#ccaa55' } }).png().toBuffer();
    const file = (name) => ({ buffer: png, mimetype: 'image/png', originalname: name, size: png.length });
    const res = await new Promise((resolve) => {
      const r = { status: (c) => ({ json: (b) => resolve({ status: c, body: b }) }), json: (b) => resolve({ status: 200, body: b }) };
      createJob(
        { params: { id: productId }, files: [file('side.png'), file('main.png'), file('angle.png')], body: { roles: ['side_profile', 'main_front', 'angle_45'] } },
        r,
        (err) => resolve({ status: err?.status ?? 500, error: err }),
      );
    });
    assert.equal(res.status, 202, res.error?.message);
    created.push(res.body.jobId);
    const job = await findJobById(res.body.jobId);
    const urls = job.reference_image_urls;
    assert.equal(urls.length, 3);
    assert.match(urls[0], /-main_front\.jpeg$/);
    assert.match(urls[1], /-angle_45\.jpeg$/);
    assert.match(urls[2], /-side_profile\.jpeg$/);
    assert.deepEqual(referenceAvailability(urls), { angle45: true, side: true });
    for (const url of urls) await storageProvider.delete(keyFromUrl(url));
    await query("UPDATE ai_studio_jobs SET status = 'cancelled' WHERE id = $1", [job.id]);
  });

  for (const [name, urls] of Object.entries(COMBOS)) {
    test(`${name}: six assets, views chosen from the references`, async () => {
      const job = await insertJob({ productId, referenceImageUrls: urls });
      created.push(job.id);
      await query("UPDATE ai_studio_jobs SET status = 'awaiting_confirmation' WHERE id = $1", [job.id]);
      const res = await confirm(job.id, { jewelleryType: 'PENDANT', customerCategory: 'GENTS' });
      assert.equal(res.status, 202, res.error?.message);

      const assets = await findAssetsByJobId(job.id);
      assert.equal(assets.length, 6);
      const saved = await findJobById(job.id);
      const avail = referenceAvailability(urls);
      assert.equal(assets[1].asset_type, avail.angle45 ? 'YELLOW_HERO_45' : 'YELLOW_SLIGHT_ANGLE');
      assert.equal(assets[2].asset_type, avail.side ? 'YELLOW_SIDE' : 'YELLOW_ELEVATED_DETAIL');
      assert.equal(saved.output_manifest[1].references.geometry, avail.angle45 ? 'angle_45' : 'main_front');
      assert.equal(saved.output_manifest[2].references.geometry, avail.side ? 'side_profile' : 'main_front');
      await query("UPDATE ai_studio_jobs SET status = 'cancelled' WHERE id = $1", [job.id]);
    });
  }
});
