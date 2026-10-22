import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deriveJobStatus } from '../../src/jobs/aiStudioJob.js';
import { confirmSchema } from '../../src/controllers/aiStudio.controller.js';
import {
  JEWELLERY_TYPES,
  resolveAssetTypesForJob,
  previewPromptsForJob,
  metalColorForAssetType,
  effectiveGenerateRoseGold,
  RING_OUTPUT_NAMES,
  ASSET_DISPLAY_ORDER,
} from '../../src/services/aiStudioService.js';
import { query } from '../../src/config/db.js';
import { insertJob, findCategoryTemplate } from '../../src/repositories/aiStudio.repository.js';

const asset = (status) => ({ status });

describe('deriveJobStatus (plan §4/§6 3-way terminal rule)', () => {
  test('all 4 READY -> review_ready', () => {
    assert.equal(
      deriveJobStatus([asset('READY'), asset('READY'), asset('READY'), asset('READY')]),
      'review_ready',
    );
  });

  test('at least one READY and one FAILED -> partially_failed', () => {
    assert.equal(
      deriveJobStatus([asset('READY'), asset('FAILED'), asset('READY'), asset('READY')]),
      'partially_failed',
    );
  });

  test('all 4 FAILED -> failed', () => {
    assert.equal(
      deriveJobStatus([asset('FAILED'), asset('FAILED'), asset('FAILED'), asset('FAILED')]),
      'failed',
    );
  });

  test('still in flight (some PENDING/GENERATING) -> null, no status change yet', () => {
    assert.equal(
      deriveJobStatus([asset('READY'), asset('GENERATING'), asset('PENDING'), asset('READY')]),
      null,
    );
  });
});

describe('confirmSchema (plan §5: UNKNOWN and low-confidence handling)', () => {
  test('rejects UNKNOWN — generation always needs a real category', () => {
    assert.throws(() => confirmSchema.parse({ jewelleryType: 'UNKNOWN' }));
  });

  test('rejects a missing jewelleryType — never silently falls back to the analysis result', () => {
    assert.throws(() => confirmSchema.parse({}));
  });

  test('accepts every real jewellery type with no presenter (No Presenter is valid)', () => {
    for (const type of JEWELLERY_TYPES.filter((t) => t !== 'UNKNOWN')) {
      assert.doesNotThrow(() => confirmSchema.parse({ jewelleryType: type, presenterId: null }));
    }
  });

  test('accepts an explicit generateRoseGold + presenterId', () => {
    assert.doesNotThrow(() =>
      confirmSchema.parse({
        jewelleryType: 'RING',
        presenterId: '123e4567-e89b-12d3-a456-426614174000',
        generateRoseGold: true,
      }),
    );
  });

  test('rejects a non-uuid presenterId', () => {
    assert.throws(() => confirmSchema.parse({ jewelleryType: 'RING', presenterId: 'not-a-uuid' }));
  });
});

describe('resolveAssetTypesForJob (rose gold toggle x presenter selection)', () => {
  test('rose gold off, no presenter -> 2 yellow catalogue shots', () => {
    assert.deepEqual(
      resolveAssetTypesForJob({ generateRoseGold: false, hasPresenter: false }),
      ['YELLOW_FRONT', 'YELLOW_HERO_45'],
    );
  });

  test('rose gold off, presenter selected -> 4, both yellow presenter views', () => {
    assert.deepEqual(
      resolveAssetTypesForJob({ generateRoseGold: false, hasPresenter: true }),
      ['YELLOW_FRONT', 'YELLOW_HERO_45', 'PRESENTER_YELLOW_1', 'PRESENTER_YELLOW_2'],
    );
  });

  test('rose gold on, no presenter -> 4, yellow + rose catalogue shots', () => {
    assert.deepEqual(
      resolveAssetTypesForJob({ generateRoseGold: true, hasPresenter: false }),
      ['YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45'],
    );
  });

  test('rose gold on, presenter selected -> 6, matched yellow/rose presenter pair', () => {
    assert.deepEqual(
      resolveAssetTypesForJob({ generateRoseGold: true, hasPresenter: true }),
      ['YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45', 'PRESENTER_YELLOW_1', 'PRESENTER_ROSE'],
    );
  });
});

describe('resolveAssetTypesForJob — Ring-only output structure (9karet)', () => {
  test('always exactly 4 Yellow Gold views — Hero, Front, Side, Macro — whatever the toggles say', () => {
    for (const generateRoseGold of [false, true]) {
      for (const hasPresenter of [false, true]) {
        assert.deepEqual(
          resolveAssetTypesForJob({ generateRoseGold, hasPresenter, confirmedType: 'RING' }),
          ['RING_GOLD_HERO', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_GOLD_MACRO'],
        );
      }
    }
  });

  test('never produces rose gold, hand, presenter or generic 45° shots for Ring', () => {
    const types = resolveAssetTypesForJob({ generateRoseGold: true, hasPresenter: true, confirmedType: 'RING' });
    assert.ok(!types.some((t) => /ROSE|HAND|PRESENTER|HERO_45/.test(t)));
  });

  test('Ring never records rose gold as on; Necklace still forces it; others follow the toggle', () => {
    assert.equal(effectiveGenerateRoseGold('RING', true), false);
    assert.equal(effectiveGenerateRoseGold('NECKLACE', false), true);
    assert.equal(effectiveGenerateRoseGold('EARRINGS', true), true);
    assert.equal(effectiveGenerateRoseGold('EARRINGS', false), false);
  });

  test('display order and output names follow the spec: yellow_gold_hero, _front, _side, _macro', () => {
    assert.deepEqual(
      ['RING_GOLD_HERO', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_GOLD_MACRO'].map((t) => [ASSET_DISPLAY_ORDER[t], RING_OUTPUT_NAMES[t]]),
      [
        [0, 'yellow_gold_hero'],
        [1, 'yellow_gold_front'],
        [2, 'yellow_gold_side'],
        [3, 'yellow_gold_macro'],
      ],
    );
  });
});

describe('metalColorForAssetType — Ring types', () => {
  test('all four Ring views are Yellow', () => {
    for (const t of ['RING_GOLD_HERO', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_GOLD_MACRO']) assert.equal(metalColorForAssetType(t, true), 'YELLOW');
  });

  test('legacy RING_ROSE_* images from older jobs still read as Rose', () => {
    assert.equal(metalColorForAssetType('RING_ROSE_FRONT', true), 'ROSE');
    assert.equal(metalColorForAssetType('RING_ROSE_SIDE', true), 'ROSE');
  });
});

describe('category templates (plan §9 — table-driven, all 12 categories)', () => {
  test('every jewellery type except UNKNOWN has a complete, active template', async () => {
    const realTypes = JEWELLERY_TYPES.filter((t) => t !== 'UNKNOWN');
    for (const type of realTypes) {
      const template = await findCategoryTemplate(type);
      assert.ok(template, `missing template for ${type}`);
      assert.ok(template.front_prompt);
      assert.ok(template.hero_45_prompt);
      assert.ok(template.presenter_placement);
      assert.ok(template.presenter_crop);
      assert.ok(template.lifestyle_prompt);
    }
    // 10 original types + BROOCH + OTHER (added for mandatory category
    // confirmation — see .claude/plans/sprightly-watching-mccarthy.md).
    assert.equal(realTypes.length, 12);
  });
});

const FAKE_TEMPLATE = {
  front_prompt: 'FRONT_PROMPT_TEXT',
  hero_45_prompt: 'HERO_PROMPT_TEXT',
  presenter_placement: 'hand-focused presenter shot',
  presenter_crop: 'portrait 4:5',
};
const FAKE_PRESENTER = { prompt_descriptor: 'a friendly presenter', style_label: 'Contemporary' };

describe('previewPromptsForJob (Review Prompts panel — pure, no DB/API calls)', () => {
  test('recommended mode: no presenter, rose gold off -> 2 catalogue prompts, no placement rules', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'EARRINGS',
      template: FAKE_TEMPLATE,
      presenter: null,
      generateRoseGold: false,
      overridesByAssetType: undefined,
    });
    assert.deepEqual(previews.map((p) => p.assetType), ['YELLOW_FRONT', 'YELLOW_HERO_45']);
    for (const p of previews) {
      assert.equal(p.mode, 'recommended');
      assert.equal(p.categoryPlacementRules.length, 0);
      assert.ok(p.lockedProductRules.some((s) => s.includes('confirmed product category is Earrings')));
    }
  });

  test('Bracelet gets a clasp-hidden negative instruction on every generated view, and it does not leak to other categories', () => {
    const braceletPreviews = previewPromptsForJob({
      confirmedType: 'BRACELET',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    // Same 6 asset types/order as any other non-Ring category — the clasp
    // rule must not change what gets generated, only add a negative.
    assert.deepEqual(
      braceletPreviews.map((p) => p.assetType),
      ['YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45', 'PRESENTER_YELLOW_1', 'PRESENTER_ROSE'],
    );
    for (const p of braceletPreviews) {
      assert.ok(
        p.negativeInstructions.some((n) => /clasp/i.test(n) && /lock/i.test(n)),
        `missing clasp-hidden negative for ${p.assetType}`,
      );
      assert.match(p.finalPrompt, /do not show the bracelet's lock, clasp/i);
    }

    const banglePreviews = previewPromptsForJob({
      confirmedType: 'BANGLE',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    for (const p of banglePreviews) {
      assert.ok(!p.negativeInstructions.some((n) => /clasp/i.test(n)), `clasp rule leaked into BANGLE for ${p.assetType}`);
    }
  });

  test('a presenter picked for a Ring job is ignored — Ring only ever gets its four catalogue views', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: false,
      overridesByAssetType: undefined,
    });
    assert.ok(previews.every((p) => p.assetType.startsWith('RING_GOLD_')));
    assert.ok(previews.every((p) => !/presenter reference photo/i.test(p.finalPrompt)));
  });

  test('every non-Ring jewellery type gets a non-empty presenter placement rule, including the generic-fallback types', () => {
    for (const type of JEWELLERY_TYPES.filter((t) => t !== 'UNKNOWN' && t !== 'RING')) {
      const previews = previewPromptsForJob({
        confirmedType: type,
        template: FAKE_TEMPLATE,
        presenter: FAKE_PRESENTER,
        generateRoseGold: false,
        overridesByAssetType: undefined,
      });
      const presenterShot = previews.find((p) => p.assetType.startsWith('PRESENTER_'));
      assert.ok(presenterShot, `no presenter asset planned for ${type}`);
      assert.equal(presenterShot.categoryPlacementRules.length, 1, `missing placement rule for ${type}`);
      assert.ok(presenterShot.categoryPlacementRules[0].length > 20, `placement rule too short for ${type}`);
    }
  });

  test('customising one card only changes its own creative fields — locked rules and placement rules are identical to the recommended version, and other cards are untouched', () => {
    const recommended = previewPromptsForJob({
      confirmedType: 'NECKLACE',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: false,
      overridesByAssetType: undefined,
    });
    const customised = previewPromptsForJob({
      confirmedType: 'NECKLACE',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: false,
      overridesByAssetType: { PRESENTER_YELLOW_1: { background: 'a custom studio backdrop' } },
    });

    for (let i = 0; i < recommended.length; i++) {
      assert.deepEqual(customised[i].lockedProductRules, recommended[i].lockedProductRules);
      assert.deepEqual(customised[i].categoryPlacementRules, recommended[i].categoryPlacementRules);
    }

    const customCard = customised.find((p) => p.assetType === 'PRESENTER_YELLOW_1');
    assert.equal(customCard.mode, 'customised');
    assert.equal(customCard.creativeInstructions.background, 'a custom studio backdrop');
    assert.ok(customCard.finalPrompt.includes('a custom studio backdrop'));

    const untouchedCard = customised.find((p) => p.assetType === 'YELLOW_FRONT');
    assert.equal(untouchedCard.mode, 'recommended');
  });

  test('rose gold on + presenter -> 6 assets, matched yellow/rose presenter pair, rose prompt mentions rose gold', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'BANGLE',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    assert.deepEqual(
      previews.map((p) => p.assetType),
      ['YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45', 'PRESENTER_YELLOW_1', 'PRESENTER_ROSE'],
    );
    const rosePresenter = previews.find((p) => p.assetType === 'PRESENTER_ROSE');
    assert.match(rosePresenter.finalPrompt, /rose gold/i);
  });
});

describe('Gents presenter identity consistency — scoped to GENTS only', () => {
  test('both Gents presenter shots carry the same identity-lock instructions, referencing the attached identity photo rather than a picked presenter', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'BANGLE',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: true,
      overridesByAssetType: undefined,
      confirmedCustomerCategory: 'GENTS',
    });
    const presenterShots = previews.filter((p) => p.assetType.startsWith('PRESENTER_'));
    assert.equal(presenterShots.length, 2);
    for (const shot of presenterShots) {
      assert.match(shot.finalPrompt, /first attached (reference photo|identity reference photo)/i);
      assert.match(shot.finalPrompt, /second attached reference photo is the exact jewellery product/i);
      assert.match(shot.finalPrompt, /do not generate a different man/i);
      assert.doesNotMatch(shot.finalPrompt, /matching the attached presenter reference photo/i);
      assert.doesNotMatch(shot.finalPrompt, /a friendly presenter/i);
    }
  });

  test('Kids and Women/no-category presenter prompts are unaffected by the Gents identity-lock text', () => {
    const kidsPreviews = previewPromptsForJob({
      confirmedType: 'BANGLE',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: false,
      overridesByAssetType: undefined,
      confirmedCustomerCategory: 'KIDS',
    });
    for (const shot of kidsPreviews.filter((p) => p.assetType.startsWith('PRESENTER_'))) {
      assert.doesNotMatch(shot.finalPrompt, /identity reference photo/i);
      assert.doesNotMatch(shot.finalPrompt, /do not generate a different man/i);
    }

    const womenPreviews = previewPromptsForJob({
      confirmedType: 'BANGLE',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: false,
      overridesByAssetType: undefined,
    });
    for (const shot of womenPreviews.filter((p) => p.assetType.startsWith('PRESENTER_'))) {
      assert.doesNotMatch(shot.finalPrompt, /identity reference photo/i);
      assert.match(shot.finalPrompt, /matching the attached presenter reference photo/i);
    }
  });

  test('Ring views are untouched by confirmedCustomerCategory GENTS — no presenter or identity text', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: FAKE_TEMPLATE,
      presenter: null,
      generateRoseGold: false,
      overridesByAssetType: undefined,
      confirmedCustomerCategory: 'GENTS',
    });
    for (const p of previews) {
      assert.doesNotMatch(p.finalPrompt, /identity reference photo|adult male model/i);
    }
  });

  test('catalogue-only shots (no presenter) are untouched for a Gents job', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'NECKLACE',
      template: FAKE_TEMPLATE,
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
      confirmedCustomerCategory: 'GENTS',
    });
    assert.deepEqual(
      previews.map((p) => p.assetType),
      ['YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45'],
    );
    for (const p of previews) {
      assert.doesNotMatch(p.finalPrompt, /identity reference photo/i);
    }
  });
});

describe('previewPromptsForJob — Ring four-view catalogue set (9karet)', () => {
  const ring = () =>
    previewPromptsForJob({
      confirmedType: 'RING',
      template: { ...FAKE_TEMPLATE },
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
  const byType = (previews, t) => previews.find((p) => p.assetType === t);

  test('4 prompts in spec order, all yellow gold, even with the rose toggle on', () => {
    const previews = ring();
    assert.deepEqual(previews.map((p) => p.assetType), ['RING_GOLD_HERO', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_GOLD_MACRO']);
    for (const p of previews) assert.equal(p.metalColor, 'YELLOW');
  });

  test('every view shares the common rules: 816 × 816 square, white background, yellow gold only, consistent lighting', () => {
    for (const p of ring()) {
      assert.match(p.finalPrompt, /816 × 816px \(1:1\)/);
      assert.match(p.finalPrompt, /pure white \(#FFFFFF\)/);
      assert.doesNotMatch(p.finalPrompt, /satin/i);
      assert.match(p.finalPrompt, /same lighting, white balance and soft shadow style/i);
      assert.match(p.finalPrompt, /do not generate a rose-gold or white-gold version/i);
      assert.match(p.finalPrompt, /never excessively orange/i);
      assert.match(p.finalPrompt, /do not add unrealistic reflections or artificial sparkle/i);
      assert.match(p.finalPrompt, /do not show hands, fingers, a model/i);
      assert.match(p.finalPrompt, /convert the ring into a bangle or bracelet/i);
    }
  });

  test('stone colours are held: colourless stays colourless, coloured gemstones keep their colour', () => {
    for (const p of ring()) {
      assert.match(p.finalPrompt, /keep colourless stones \(diamonds, cubic zirconia\) colourless/i);
      assert.match(p.finalPrompt, /every coloured gemstone its exact original colour/i);
    }
  });

  test('each view has its own angle: hero upright 40-45°, front horizontal, side upright profile, macro close-up', () => {
    const previews = ring();
    assert.match(byType(previews, 'RING_GOLD_HERO').finalPrompt, /upright on its band.*40-45 degree three-quarter/i);
    assert.match(byType(previews, 'RING_GOLD_HERO').finalPrompt, /primary product and product-list image/i);
    assert.match(byType(previews, 'RING_GOLD_FRONT').finalPrompt, /lay the ring horizontally/i);
    assert.match(byType(previews, 'RING_GOLD_SIDE').finalPrompt, /stand the ring upright and photograph it from the side/i);
    assert.match(byType(previews, 'RING_GOLD_SIDE').finalPrompt, /do not reuse or slightly rotate the hero/i);
    assert.match(byType(previews, 'RING_GOLD_MACRO').finalPrompt, /close-up of the main design/i);
    const compositions = new Set(previews.map((p) => p.creativeInstructions.composition));
    assert.equal(compositions.size, 4);
  });

  test('hero, front and side must not crop the ring; only the macro may cut off the band', () => {
    const previews = ring();
    for (const t of ['RING_GOLD_HERO', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE']) {
      assert.match(byType(previews, t).finalPrompt, /do not crop any part of the ring out of frame/i);
    }
    const macro = byType(previews, 'RING_GOLD_MACRO').finalPrompt;
    assert.doesNotMatch(macro, /do not crop any part of the ring out of frame/i);
    assert.match(macro, /part of the band may extend outside the frame/i);
    assert.match(macro, /do not crop any important stone or primary design detail/i);
  });
});

describe('duplicate active job prevention (plan §8)', () => {
  test('a second active job for the same product is rejected by the partial unique index', async () => {
    const {
      rows: [{ id: productId }],
    } = await query('SELECT id FROM products LIMIT 1');

    const first = await insertJob({ productId, referenceImageUrls: ['http://x/test1.jpg'] });
    try {
      await assert.rejects(
        () => insertJob({ productId, referenceImageUrls: ['http://x/test2.jpg'] }),
        (err) => err.code === '23505',
      );
    } finally {
      await query('DELETE FROM ai_studio_jobs WHERE id = $1', [first.id]);
    }
  });

  test('a new job is allowed once the previous one reaches a terminal status', async () => {
    const {
      rows: [{ id: productId }],
    } = await query('SELECT id FROM products LIMIT 1');

    const first = await insertJob({ productId, referenceImageUrls: ['http://x/test1.jpg'] });
    await query("UPDATE ai_studio_jobs SET status = 'completed' WHERE id = $1", [first.id]);

    const second = await insertJob({ productId, referenceImageUrls: ['http://x/test2.jpg'] });
    await query('DELETE FROM ai_studio_jobs WHERE id IN ($1, $2)', [first.id, second.id]);
  });
});
