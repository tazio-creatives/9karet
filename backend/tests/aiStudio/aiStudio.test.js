import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deriveJobStatus } from '../../src/jobs/aiStudioJob.js';
import { confirmSchema } from '../../src/controllers/aiStudio.controller.js';
import {
  JEWELLERY_TYPES,
  resolveAssetTypesForJob,
  previewPromptsForJob,
  metalColorForAssetType,
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

describe('resolveAssetTypesForJob — Ring-only output structure', () => {
  test('confirmedType RING, rose gold off -> exactly 4: both hand poses + gold front/side, no 45° hero, ignores hasPresenter', () => {
    assert.deepEqual(
      resolveAssetTypesForJob({ generateRoseGold: false, hasPresenter: true, confirmedType: 'RING' }),
      ['RING_HAND_1', 'RING_HAND_2', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE'],
    );
  });

  test('confirmedType RING, rose gold on -> exactly 6, in the client-mandated Position 1-6 order', () => {
    assert.deepEqual(
      resolveAssetTypesForJob({ generateRoseGold: true, hasPresenter: false, confirmedType: 'RING' }),
      ['RING_HAND_1', 'RING_HAND_2', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE'],
    );
  });

  test('never produces a 45° Hero or PRESENTER_* asset for Ring', () => {
    const types = resolveAssetTypesForJob({ generateRoseGold: true, hasPresenter: true, confirmedType: 'RING' });
    assert.ok(!types.some((t) => t.includes('HERO_45')));
    assert.ok(!types.some((t) => t.startsWith('PRESENTER_')));
  });
});

describe('metalColorForAssetType — Ring types', () => {
  test('RING_HAND_1 and RING_GOLD_* are always Yellow', () => {
    assert.equal(metalColorForAssetType('RING_HAND_1', true), 'YELLOW');
    assert.equal(metalColorForAssetType('RING_GOLD_FRONT', true), 'YELLOW');
    assert.equal(metalColorForAssetType('RING_GOLD_SIDE', false), 'YELLOW');
  });

  test('RING_ROSE_* are always Rose', () => {
    assert.equal(metalColorForAssetType('RING_ROSE_FRONT', true), 'ROSE');
    assert.equal(metalColorForAssetType('RING_ROSE_SIDE', true), 'ROSE');
  });

  test('RING_HAND_2 follows the Rose Gold toggle — Rose when required, Gold otherwise', () => {
    assert.equal(metalColorForAssetType('RING_HAND_2', true), 'ROSE');
    assert.equal(metalColorForAssetType('RING_HAND_2', false), 'YELLOW');
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

  test('presenter shots include the exact spec-mandated Ring placement/exclusion wording (Problem 2) — a non-Ring category still using the generic Presenter flow', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: false,
      overridesByAssetType: undefined,
    });
    // RING now uses the dedicated hand-pose workflow, not PRESENTER_* — its
    // hand shots carry the ring-finger placement wording directly instead.
    const handShot = previews.find((p) => p.assetType === 'RING_HAND_1');
    assert.equal(handShot.categoryPlacementRules.length, 1);
    assert.match(handShot.categoryPlacementRules[0], /ring finger/i);
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

  test('Ring hand shots are completely untouched by confirmedCustomerCategory GENTS (existing hand-only workflow preserved)', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: FAKE_TEMPLATE,
      presenter: null,
      generateRoseGold: false,
      overridesByAssetType: undefined,
      confirmedCustomerCategory: 'GENTS',
    });
    for (const p of previews) {
      assert.doesNotMatch(p.finalPrompt, /identity reference photo/i);
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

describe('previewPromptsForJob — Ring-only output structure', () => {
  const RING_TEMPLATE = { ...FAKE_TEMPLATE };

  test('6-image plan uses the exact spec labels/order and never a 45° Hero', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    assert.deepEqual(
      previews.map((p) => p.assetType),
      ['RING_HAND_1', 'RING_HAND_2', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE'],
    );
    // "45 degree" legitimately appears in Front View's own negative
    // instruction ("do not rotate to a 30-45 degree angle") — what must
    // never appear is the dedicated three-quarter Hero shot's own wording.
    assert.ok(!previews.some((p) => p.finalPrompt.includes('three-quarter hero view')));
  });

  test('4-image plan (no Rose Gold) is just the first 4', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: false,
      overridesByAssetType: undefined,
    });
    assert.deepEqual(
      previews.map((p) => p.assetType),
      ['RING_HAND_1', 'RING_HAND_2', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE'],
    );
    // No Rose Gold required -> Hand Pose 2 falls back to Gold, not Rose.
    const hand2 = previews.find((p) => p.assetType === 'RING_HAND_2');
    assert.equal(hand2.metalColor, 'YELLOW');
  });

  test('Hand Image 1 and Hand Image 2 are always the two fixed, distinct lifestyle poses — no admin pose choice involved', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: false,
      overridesByAssetType: undefined,
    });
    const hand1 = previews.find((p) => p.assetType === 'RING_HAND_1');
    const hand2 = previews.find((p) => p.assetType === 'RING_HAND_2');
    assert.notEqual(hand1.categoryPlacementRules[0], hand2.categoryPlacementRules[0]);
    assert.match(hand1.categoryPlacementRules[0], /her face may be visible/i);
    assert.match(hand2.categoryPlacementRules[0], /closer crop/i);
    assert.match(hand2.categoryPlacementRules[0], /full face does not need to be visible/i);
    assert.match(hand2.finalPrompt, /different hand position from Hand Image 1/i);
  });

  test('hand shots allow a visible face, exclude other jewellery, and require exactly one ring', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    for (const assetType of ['RING_HAND_1', 'RING_HAND_2']) {
      const shot = previews.find((p) => p.assetType === assetType);
      assert.doesNotMatch(shot.finalPrompt, /do not show a face/i);
      assert.match(shot.finalPrompt, /do not show earrings, a necklace, or any other distracting jewellery/i);
      assert.match(shot.finalPrompt, /exactly one ring/i);
      assert.match(shot.finalPrompt, /five naturally proportioned fingers/i);
    }
  });

  test('hand shots carry the strict physical-placement rules: wrap the finger, no floating/pasting/embedding, correct finger, no added/removed stones', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    for (const assetType of ['RING_HAND_1', 'RING_HAND_2']) {
      const shot = previews.find((p) => p.assetType === assetType);
      assert.match(shot.finalPrompt, /physically wrap around the ring finger/i);
      assert.match(shot.finalPrompt, /decorative top sits above the finger/i);
      assert.match(shot.finalPrompt, /rear band is hidden behind the finger/i);
      assert.match(shot.finalPrompt, /do not make the ring float above the skin/i);
      assert.match(shot.finalPrompt, /do not paste the complete circular band flatly/i);
      assert.match(shot.finalPrompt, /do not embed the ring inside the skin/i);
      assert.match(shot.finalPrompt, /do not place the ring on the wrong finger/i);
      assert.match(shot.finalPrompt, /do not add or remove any stones/i);
    }
  });

  test('hand shots use a natural background that is never tied to the metal colour', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    const hand1 = previews.find((p) => p.assetType === 'RING_HAND_1'); // Yellow Gold
    const hand2 = previews.find((p) => p.assetType === 'RING_HAND_2'); // Rose Gold
    // Same background instruction regardless of the metal colour of the shot.
    assert.equal(hand1.creativeInstructions.background, hand2.creativeInstructions.background);
    assert.match(hand1.finalPrompt, /natural photographic environment/i);
    assert.match(hand1.finalPrompt, /do not force a champagne, ivory, peach or rose-coloured background/i);
    assert.doesNotMatch(hand1.finalPrompt, /#FFFFFF/);
  });

  test('Front View is a true direct view, explicitly not the tilted orientation used for the Three-Quarter Side View', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    const goldFront = previews.find((p) => p.assetType === 'RING_GOLD_FRONT');
    assert.match(goldFront.finalPrompt, /centre stone.*visual centre/i);
    assert.match(goldFront.finalPrompt, /do not stand the ring vertically upright/i);
    assert.match(goldFront.finalPrompt, /do not display the circular band opening as the main shape/i);
    assert.match(goldFront.finalPrompt, /do not rotate the ring to a 30-45 degree angle/i);
  });

  test('Three-Quarter Side View prompts are distinct from Front View and explicitly reject a front-facing or fully upright result', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    const goldFront = previews.find((p) => p.assetType === 'RING_GOLD_FRONT');
    const goldSide = previews.find((p) => p.assetType === 'RING_GOLD_SIDE');
    assert.notEqual(goldFront.finalPrompt, goldSide.finalPrompt);
    assert.match(goldSide.finalPrompt, /elevated three-quarter angle/i);
    assert.match(goldSide.finalPrompt, /35-45 degrees/i);
    assert.match(goldSide.finalPrompt, /band opening/i);
    assert.match(goldSide.finalPrompt, /both the left and right shoulders/i);
    assert.match(goldSide.finalPrompt, /do not use a direct front-facing angle/i);
    assert.match(goldSide.finalPrompt, /do not stand the ring completely upright/i);

    const roseSide = previews.find((p) => p.assetType === 'RING_ROSE_SIDE');
    assert.match(roseSide.finalPrompt, /opposite direction from the gold three-quarter side view/i);
  });

  test('every Ring asset carries the extra Ring-only fidelity/no-bangle-conversion instruction', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    for (const p of previews) {
      assert.match(p.finalPrompt, /convert the ring into a bangle or bracelet/i);
    }
  });

  test('Gold and Rose catalogue shots both use the pure white studio background', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    const goldFront = previews.find((p) => p.assetType === 'RING_GOLD_FRONT');
    assert.match(goldFront.finalPrompt, /pure white \(#FFFFFF\)/);
    assert.doesNotMatch(goldFront.finalPrompt, /satin/i);
    const roseFront = previews.find((p) => p.assetType === 'RING_ROSE_FRONT');
    assert.match(roseFront.finalPrompt, /pure white \(#FFFFFF\)/);
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
