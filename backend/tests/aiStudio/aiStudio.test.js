import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deriveJobStatus } from '../../src/jobs/aiStudioJob.js';
import { confirmSchema } from '../../src/controllers/aiStudio.controller.js';
import {
  JEWELLERY_TYPES,
  previewPromptsForJob,
  metalColorForAssetType,
  buildOutputManifest,
  assertValidManifest,
  effectiveGenerateRoseGold,
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

describe('output manifest — always exactly 6 slots (9karet)', () => {
  const plan = (confirmedType, generateRoseGold) =>
    buildOutputManifest({ confirmedType, generateRoseGold }).map((m) => `${m.slotKey}=${m.assetType}`);

  test('Rose Gold OFF, non-Ring: 4 yellow catalogue + 2 yellow presenter, existing Front/45° first', () => {
    assert.deepEqual(plan('EARRINGS', false), [
      'yellow_catalogue_1=YELLOW_FRONT',
      'yellow_catalogue_2=YELLOW_HERO_45',
      'yellow_catalogue_3=YELLOW_SIDE',
      'yellow_catalogue_4=YELLOW_MACRO',
      'yellow_presenter_1=PRESENTER_YELLOW_1',
      'yellow_presenter_2=PRESENTER_YELLOW_2',
    ]);
  });

  test('Rose Gold ON, non-Ring: 2 yellow + the same 2 views in rose, then a yellow and a rose presenter', () => {
    assert.deepEqual(plan('EARRINGS', true), [
      'yellow_catalogue_1=YELLOW_FRONT',
      'yellow_catalogue_2=YELLOW_HERO_45',
      'rose_catalogue_1=ROSE_FRONT',
      'rose_catalogue_2=ROSE_HERO_45',
      'yellow_presenter_1=PRESENTER_YELLOW_1',
      'rose_presenter_1=PRESENTER_ROSE',
    ]);
  });

  test('Rose Gold OFF, Ring: hero, front/top, side profile, macro, then two yellow hand shots', () => {
    assert.deepEqual(plan('RING', false), [
      'yellow_catalogue_1=RING_GOLD_HERO',
      'yellow_catalogue_2=RING_GOLD_FRONT',
      'yellow_catalogue_3=RING_GOLD_PROFILE',
      'yellow_catalogue_4=RING_GOLD_MACRO',
      'yellow_presenter_1=RING_HAND_1',
      'yellow_presenter_2=RING_HAND_2',
    ]);
  });

  test('Rose Gold ON, Ring: yellow hero + front, rose hero + front, yellow hand, rose hand', () => {
    assert.deepEqual(plan('RING', true), [
      'yellow_catalogue_1=RING_GOLD_HERO',
      'yellow_catalogue_2=RING_GOLD_FRONT',
      'rose_catalogue_1=RING_ROSE_HERO',
      'rose_catalogue_2=RING_ROSE_FRONT',
      'yellow_presenter_1=RING_HAND_1',
      'rose_presenter_1=RING_HAND_ROSE',
    ]);
  });

  test('every category, both modes: 6 unique slots, 4 catalogue + 2 presenter, 0 or 3 rose, metals match the asset type', () => {
    for (const type of JEWELLERY_TYPES.filter((t) => t !== 'UNKNOWN')) {
      for (const rose of [false, true]) {
        const m = buildOutputManifest({ confirmedType: type, generateRoseGold: rose });
        assert.equal(m.length, 6);
        assert.equal(new Set(m.map((x) => x.slotKey)).size, 6);
        assert.equal(m.filter((x) => x.kind === 'catalogue').length, 4);
        assert.equal(m.filter((x) => x.kind === 'presenter').length, 2);
        assert.equal(m.filter((x) => x.metal === 'ROSE').length, rose ? 3 : 0);
        assert.equal(m.filter((x) => x.metal === 'YELLOW').length, rose ? 3 : 6);
        assert.deepEqual(m.map((x) => x.index), [0, 1, 2, 3, 4, 5]);
        for (const x of m) assert.equal(metalColorForAssetType(x.assetType, rose), x.metal, `${type} ${x.slotKey}`);
      }
    }
  });

  test('rose views repeat exactly the first two yellow views', () => {
    for (const type of ['RING', 'NECKLACE']) {
      const m = buildOutputManifest({ confirmedType: type, generateRoseGold: true });
      assert.deepEqual(
        m.slice(2, 4).map((x) => x.assetType.replace('ROSE', 'GOLD').replace(/^GOLD_/, 'YELLOW_')),
        m.slice(0, 2).map((x) => x.assetType),
      );
    }
  });

  test('assertValidManifest rejects a wrong count, duplicate slots and rose slots in an OFF plan', () => {
    const good = buildOutputManifest({ confirmedType: 'PENDANT', generateRoseGold: false });
    assert.throws(() => assertValidManifest(good.slice(0, 5), { generateRoseGold: false }), /6 slots/);
    assert.throws(() => assertValidManifest([...good.slice(0, 5), good[0]], { generateRoseGold: false }), /unique/);
    const withRose = buildOutputManifest({ confirmedType: 'PENDANT', generateRoseGold: true });
    assert.throws(() => assertValidManifest(withRose, { generateRoseGold: false }), /rose-gold slot/);
  });

  test('the switch is exactly what the admin chose — no category forces rose gold any more', () => {
    for (const type of ['RING', 'NECKLACE', 'EARRINGS']) {
      assert.equal(effectiveGenerateRoseGold(type, false), false);
      assert.equal(effectiveGenerateRoseGold(type, undefined), false);
      assert.equal(effectiveGenerateRoseGold(type, true), true);
    }
  });

  test('Rose Gold OFF prompts never ask for rose gold', () => {
    for (const type of ['RING', 'EARRINGS', 'NECKLACE']) {
      const previews = previewPromptsForJob({
        confirmedType: type,
        template: { front_prompt: 'FRONT', hero_45_prompt: 'HERO', presenter_placement: 'p', presenter_crop: 'c' },
        presenter: null,
        generateRoseGold: false,
        overridesByAssetType: undefined,
      });
      assert.equal(previews.length, 6);
      for (const p of previews) {
        assert.equal(p.metalColor, 'YELLOW');
        assert.doesNotMatch(p.finalPrompt, /rose gold|rose-gold tone/i, `${type} ${p.assetType}`);
      }
    }
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
  test('recommended mode, rose gold off: 4 catalogue prompts with no placement rules, then 2 presenter prompts', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'EARRINGS',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: false,
      overridesByAssetType: undefined,
    });
    assert.deepEqual(
      previews.map((p) => p.slotKey),
      ['yellow_catalogue_1', 'yellow_catalogue_2', 'yellow_catalogue_3', 'yellow_catalogue_4', 'yellow_presenter_1', 'yellow_presenter_2'],
    );
    for (const p of previews) {
      assert.equal(p.mode, 'recommended');
      assert.ok(p.lockedProductRules.some((s) => s.includes('confirmed product category is Earrings')));
    }
    for (const p of previews.slice(0, 4)) assert.equal(p.categoryPlacementRules.length, 0);
    for (const p of previews.slice(4)) assert.equal(p.categoryPlacementRules.length, 1);
  });

  test('side and macro views: genuine side profile, and only the macro may crop', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'PENDANT',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: false,
      overridesByAssetType: undefined,
    });
    const side = previews.find((p) => p.assetType === 'YELLOW_SIDE');
    const macro = previews.find((p) => p.assetType === 'YELLOW_MACRO');
    assert.match(side.finalPrompt, /side-profile view/i);
    assert.match(side.finalPrompt, /do not reuse or slightly rotate the 45-degree hero view/i);
    assert.match(side.finalPrompt, /do not crop any part of the jewellery out of frame/i);
    assert.match(macro.finalPrompt, /macro detail view/i);
    assert.doesNotMatch(macro.finalPrompt, /do not crop any part of the jewellery out of frame/i);
    for (const p of [side, macro]) assert.match(p.finalPrompt, /pure white \(#FFFFFF\)/);
  });

  test('both presenter images keep one identity; the second yellow one changes pose, the rose one matches the yellow pose', () => {
    const off = previewPromptsForJob({
      confirmedType: 'NECKLACE',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: false,
      overridesByAssetType: undefined,
    }).slice(4);
    for (const p of off) assert.match(p.finalPrompt, /same person — the same face, skin tone/i);
    assert.match(off[1].finalPrompt, /clearly different, category-appropriate pose or crop/i);

    const on = previewPromptsForJob({
      confirmedType: 'NECKLACE',
      template: FAKE_TEMPLATE,
      presenter: FAKE_PRESENTER,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    const rosePresenter = on.find((p) => p.slotKey === 'rose_presenter_1');
    assert.match(rosePresenter.finalPrompt, /keep the pose, crop and lighting the same so only the metal colour differs/i);
  });

  test('rose outputs change only the metal: stones stay colourless, no pink cast', () => {
    const on = previewPromptsForJob({
      confirmedType: 'RING',
      template: FAKE_TEMPLATE,
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    for (const p of on.filter((x) => x.metalColor === 'ROSE')) {
      assert.match(p.finalPrompt, /convert only the metal to a realistic, premium rose-gold tone/i);
      assert.match(p.finalPrompt, /keep diamonds and colourless stones colourless/i);
      assert.match(p.finalPrompt, /do not make the whole image pink/i);
    }
    for (const p of on.filter((x) => x.metalColor === 'YELLOW')) {
      assert.doesNotMatch(p.finalPrompt, /convert only the metal/i);
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

  test('catalogue shots are untouched for a Gents job — only the presenter shots carry the identity lock', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'NECKLACE',
      template: FAKE_TEMPLATE,
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
      confirmedCustomerCategory: 'GENTS',
    });
    for (const p of previews.slice(0, 4)) {
      assert.doesNotMatch(p.finalPrompt, /identity reference photo/i);
    }
    for (const p of previews.slice(4)) {
      assert.match(p.finalPrompt, /identity reference photo/i);
    }
  });
});

describe('previewPromptsForJob — Ring-only output structure', () => {
  const RING_TEMPLATE = { ...FAKE_TEMPLATE };

  test('Rose Gold ON: the rose hand repeats Hand Image 1 in rose gold, with the same hand identity', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: true,
      overridesByAssetType: undefined,
    });
    const hand1 = previews.find((p) => p.assetType === 'RING_HAND_1');
    const roseHand = previews.find((p) => p.assetType === 'RING_HAND_ROSE');
    assert.equal(hand1.metalColor, 'YELLOW');
    assert.equal(roseHand.metalColor, 'ROSE');
    assert.match(roseHand.finalPrompt, /rose-gold comparison of Hand Image 1/i);
    for (const p of [hand1, roseHand]) assert.match(p.finalPrompt, /same model's hand — the same skin tone/i);
  });

  test('Rose Gold OFF: Hand Pose 2 is yellow gold', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: false,
      overridesByAssetType: undefined,
    });
    assert.equal(previews.find((p) => p.assetType === 'RING_HAND_2').metalColor, 'YELLOW');
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
      generateRoseGold: false,
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
      generateRoseGold: false,
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
    const hand2 = previews.find((p) => p.assetType === 'RING_HAND_ROSE'); // Rose Gold
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

  test('Ring hero, side profile and macro: their own angles; only the macro may crop the band', () => {
    const previews = previewPromptsForJob({
      confirmedType: 'RING',
      template: RING_TEMPLATE,
      presenter: null,
      generateRoseGold: false,
      overridesByAssetType: undefined,
    });
    const by = (t) => previews.find((p) => p.assetType === t).finalPrompt;
    assert.match(by('RING_GOLD_HERO'), /upright on its band.*40-45 degree three-quarter/i);
    assert.match(by('RING_GOLD_PROFILE'), /photograph it from the side/i);
    assert.match(by('RING_GOLD_PROFILE'), /do not reuse or slightly rotate the hero/i);
    assert.match(by('RING_GOLD_MACRO'), /part of the band may extend outside the frame/i);
    for (const t of ['RING_GOLD_HERO', 'RING_GOLD_PROFILE']) assert.match(by(t), /do not crop any part of the ring out of frame/i);
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
