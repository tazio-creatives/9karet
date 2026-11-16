// Two-bangle set (TWO_BANGLE_SET): physical-item count rules for all six
// images, the Elevated Detail gold rule, one bangle per wrist on both
// presenter images, and the matching validation fields and failures.
// Pure — OpenAI is replaced by a fetch stub, so nothing here makes a network
// or paid call.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

process.env.OPENAI_API_KEY ??= 'sk-test';
process.env.OPENAI_VISION_MODEL ??= 'vision-test';
process.env.OPENAI_IMAGE_MODEL ??= 'image-test';

const {
  previewPromptsForJob,
  generateShot,
  validateGeneratedImage,
  buildValidationText,
  applyBangleValidationRules,
  banglePairCountMessage,
  BANGLE_VALIDATION_MESSAGES: M,
} = await import('../../src/services/aiStudioService.js');
const { computePromptHashes, TEMPLATE, PRESENTER } = await import('./helpers/promptHashes.mjs');

// Hashes taken from the unchanged production code (af7d9f0 / aiStudioService.js 646b7ead).
const BASELINE = JSON.parse(readFileSync(new URL('./fixtures/prompt-hashes-v4.json', import.meta.url), 'utf8'));

const BUF = Buffer.from('x');
const PAIR = 'TWO_BANGLE_SET';

function bangleJob(bangleQuantity, opts = {}) {
  return previewPromptsForJob({
    confirmedType: 'BANGLE',
    template: TEMPLATE,
    presenter: PRESENTER,
    generateRoseGold: opts.generateRoseGold ?? false,
    confirmedCustomerCategory: opts.customerCategory,
    references: opts.references ?? { angle45: false, side: false },
    bangleQuantity,
  });
}
// Every Rose Gold × reference combination a pair job can produce.
function allPairJobs() {
  const jobs = [];
  for (const generateRoseGold of [false, true]) {
    for (const angle45 of [false, true]) {
      for (const side of [false, true]) jobs.push(bangleJob(PAIR, { generateRoseGold, references: { angle45, side } }));
    }
  }
  return jobs;
}
const SHOT = {
  YELLOW_FRONT: 1, ROSE_FRONT: 1,
  YELLOW_SLIGHT_ANGLE: 2, ROSE_SLIGHT_ANGLE: 2, YELLOW_HERO_45: 2, ROSE_HERO_45: 2,
  YELLOW_ELEVATED_DETAIL: 3, YELLOW_SIDE: 3,
  YELLOW_MACRO: 4,
};
const catalogue = (previews) => previews.filter((p) => p.kind === 'catalogue');
const presenters = (previews) => previews.filter((p) => p.kind === 'presenter');

// A complete pair reviewer answer that passes; override any bangleCheck field.
function pairReview(check = {}, base = {}) {
  return {
    validationStatus: 'passed',
    detectedJewelleryTypes: ['BANGLE'],
    expectedJewelleryType: 'BANGLE',
    additionalOrnamentsDetected: [],
    placementStatus: 'correct',
    metalColourStatus: 'correct',
    productSimilarityScore: 0.95,
    validationMessages: [],
    ...base,
    bangleCheck: {
      objectsByPosition: TWO_SOLID_BANGLES,
      bangleCount: 2,
      visibleWristCount: 0,
      banglesPerVisibleWrist: [],
      otherWristJewellery: false,
      floatingIntersectingOrMisplaced: false,
      requiredBangleHiddenOrCropped: false,
      bangleSetMergedIntoOne: false,
      shapeAndDesignMatchReference: true,
      observedShotType: 'NOT_APPLICABLE',
      observedCameraAngle: '',
      observedArrangement: '',
      productsTouchOrOverlap: false,
      physicalBangleCount: 2,
      independentClosedBangleCount: 2,
      visualGroupCount: 2,
      expectedPhysicalCount: 2,
      actualPhysicalCount: 2,
      eachReferenceDesignShownOnce: true,
      duplicatedPairDetected: false,
      joinedMultiRailDesign: false,
      innerOuterEdgesMiscounted: false,
      referenceMetalColourMatch: true,
      washedOutMetal: false,
      orangeOrCopperCast: false,
      metalDetailPreserved: true,
      leftWristBangleCount: 0,
      rightWristBangleCount: 0,
      ...check,
    },
  };
}
// Fixtures (per-position descriptions as the reviewer returns them).
// One solid bangle whose inner and outer outline / inner wall is visible: one object.
const SOLID_BANGLE_INNER_OUTER = [
  { position: 'centre', separateBandsAtPosition: 2, everyBandHasItsOwnDecoratedOuterFace: false, description: 'outer star-studded face and plain inner wall of the same band' },
];
// Two solid bangles: two objects.
const TWO_SOLID_BANGLES = [
  { position: 'left', separateBandsAtPosition: 1, everyBandHasItsOwnDecoratedOuterFace: true, description: 'one solid star-studded band' },
  { position: 'right', separateBandsAtPosition: 1, everyBandHasItsOwnDecoratedOuterFace: true, description: 'one solid star-studded band' },
];
// Regression — Slight Alternate Angle (local jobs 500c704c, 7b8b2ad5): two
// positions, each a duplicated parallel pair with a visible gap = four
// objects. The reviewer reported physicalBangleCount 2.
const TWO_DUPLICATED_PAIRS = [
  { position: 'left', separateBandsAtPosition: 2, everyBandHasItsOwnDecoratedOuterFace: true, description: 'two parallel star-studded rings with a visible gap' },
  { position: 'right', separateBandsAtPosition: 2, everyBandHasItsOwnDecoratedOuterFace: true, description: 'two parallel star-studded rings with a visible gap' },
];
// Macro (local job 7b8b2ad5): each bangle's inner wall seen through the opening.
const TWO_BANGLES_INNER_WALLS_VISIBLE = [
  { position: 'left, large', separateBandsAtPosition: 2, everyBandHasItsOwnDecoratedOuterFace: false, description: 'star-studded outer face and plain inner wall of the same band' },
  { position: 'right, small', separateBandsAtPosition: 2, everyBandHasItsOwnDecoratedOuterFace: false, description: 'star-studded outer face and plain inner wall of the same band' },
];
const CATALOGUE_OK = {
  1: { observedShotType: 'FRONT_HORIZONTAL' },
  2: {
    observedShotType: 'UPRIGHT_THREE_QUARTER', anyBangleLyingFlat: false, allBanglesStandingUpright: true,
    primaryBangleUpright: true, topDownView: false, visiblyCloserDesignView: false, backgroundPureWhite: true,
  },
  3: { observedShotType: 'LOW_SIDE_DEPTH' },
  4: {
    observedShotType: 'UPRIGHT_CLOSE_DETAIL', anyBangleLyingFlat: false, allBanglesStandingUpright: true,
    primaryBangleUpright: true, topDownView: false, visiblyCloserDesignView: true, backgroundPureWhite: true,
  },
};
const WORN_OK = { visibleWristCount: 2, banglesPerVisibleWrist: [1, 1], leftWristBangleCount: 1, rightWristBangleCount: 1 };
const SHOT_ASSET = { 1: 'YELLOW_FRONT', 2: 'YELLOW_SLIGHT_ANGLE', 3: 'YELLOW_ELEVATED_DETAIL', 4: 'YELLOW_MACRO' };
const rule = (assetType, check, base) => applyBangleValidationRules(pairReview(check, base), { assetType, bangleQuantity: PAIR });
const failedWith = (result, message) => result.validationStatus === 'failed' && result.validationMessages.includes(`Failed: ${message}`);

// --- fetch stub ------------------------------------------------------------
const calls = [];
let chatReply = {};
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (init?.body instanceof FormData) {
    calls.push({ url: u, kind: 'image', prompt: init.body.get('prompt') });
    return new Response(JSON.stringify({ data: [{ b64_json: 'AA==' }] }), { headers: { 'content-type': 'application/json' } });
  }
  const body = JSON.parse(init.body);
  calls.push({ url: u, kind: 'chat', body });
  return new Response(
    JSON.stringify({
      id: 'x', object: 'chat.completion', created: 0, model: 'v',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(chatReply), refusal: null } }],
    }),
    { headers: { 'content-type': 'application/json' } },
  );
};
beforeEach(() => {
  calls.length = 0;
});

describe('Two-bangle set prompts', () => {
  test('1. every two-bangle catalogue prompt requires exactly two physical objects', () => {
    for (const job of allPairJobs()) {
      for (const p of catalogue(job)) {
        assert.match(p.finalPrompt, /this image must contain exactly two physical bangles in total — two complete rigid objects, never two pairs/, p.assetType);
        assert.match(p.finalPrompt, /Physical-item count \(mandatory\)/, p.assetType);
        assert.match(p.finalPrompt, /Show exactly two complete, separate physical bangles in this image/, p.assetType);
        assert.match(p.finalPrompt, /never add a third or fourth bangle/, p.assetType);
      }
    }
    const [front, angle, elevated, macro] = catalogue(bangleJob(PAIR));
    assert.match(front.finalPrompt, /two physical objects in total — arranged in two clean horizontal rows: one bangle above and one bangle below/);
    assert.match(angle.finalPrompt, /exactly two upright bangles in total[^.]*in clearly different orientations/);
    assert.match(angle.finalPrompt, /the LEFT bangle[^;]*wide, open oval; the RIGHT bangle[^.]*nearly side-on, so it reads as a narrow oval/);
    assert.match(angle.finalPrompt, /Do not copy the stacked arrangement of the reference photo/);
    assert.match(elevated.finalPrompt, /exactly two complete bangles in total: one bangle in the left foreground and one bangle in the right background/);
    assert.match(macro.finalPrompt, /one larger primary bangle in the foreground[^.]*one smaller second bangle/);
  });

  test('2. one physical bangle = one solid band (inner/outer edges are one item); parallel bands with a gap are two bangles', () => {
    for (const job of allPairJobs()) {
      for (const p of job) {
        assert.match(p.finalPrompt, /One physical bangle is one solid band forming one closed circumference; its inner and outer edges belong to that same band and are not separate items/, p.assetType);
        assert.match(p.finalPrompt, /Two parallel closed bands separated by a visible gap are two physical bangles, so never draw any bangle as two parallel loops, a doubled ring or a double band/, p.assetType);
        assert.match(p.finalPrompt, /each bangle is only ONE of those pieces: never copy the stacked look of the reference pair as the design of one bangle/, p.assetType);
        assert.match(p.finalPrompt, /never create extra bangles through reflections, shadows or background objects/, p.assetType);
        assert.doesNotMatch(p.finalPrompt, /genuinely has stay part of that one bangle|A bangle may have several rails/, p.assetType);
      }
    }
    // The reviewer counts complete physical objects, never outlines or positions.
    for (const p of bangleJob(PAIR)) {
      const text = buildValidationText({ confirmedType: 'BANGLE', metalColor: p.metalColor, assetType: p.assetType, bangleQuantity: PAIR });
      assert.match(text, /count complete physical jewellery objects in the GENERATED \(first\) image, never outlines, edges, positions or groups/);
      assert.match(text, /One solid bangle has an inner and an outer outline, and through its opening you may see its plain inner wall or far side: all of that is ONE object/);
      assert.match(text, /Decorative rails joined into one rigid body are ONE object/);
      assert.match(text, /Two independent closed rings running in parallel with a visible separating gap are TWO objects/);
      assert.match(text, /Two positions that each hold a duplicated parallel pair are FOUR objects/);
      assert.match(text, /it does not make them one fused bangle, and two separate bangles in the generated image are correct/);
      assert.match(text, /FIRST fill objectsByPosition/);
    }
  });

  test('3. Images 2–4 prohibit two duplicated pairs and four loops; Image 1 keeps its negatives', () => {
    const NO_DUP = 'Do not draw either bangle as two parallel loops, a doubled ring or a double band, and do not show two duplicated pairs, four loops or four rings.';
    for (const job of allPairJobs()) {
      for (const p of catalogue(job)) {
        const shot = SHOT[p.assetType];
        if (shot === 1) assert.ok(!p.negativeInstructions.includes(NO_DUP), p.assetType);
        else assert.ok(p.negativeInstructions.includes(NO_DUP), p.assetType);
        assert.match(p.finalPrompt, /Never show two pairs, three or four loops/, p.assetType);
      }
    }
    const [, angle, elevated, macro] = catalogue(bangleJob(PAIR));
    assert.match(angle.finalPrompt, /do not turn either bangle into a pair/);
    assert.match(elevated.finalPrompt, /neither position may hold a duplicated pair/);
    assert.match(macro.finalPrompt, /must never display four loops or two duplicated pairs/);
  });

  test('4. gold: the reference is the colour authority on all six images; catalogue neutral white balance, presenter lighting never changes the gold', () => {
    for (const job of allPairJobs()) {
      for (const p of job) {
        assert.match(p.finalPrompt, /the uploaded product reference is the authority for the metal colour — match its gold hue, saturation, brightness and finish as a natural, polished yellow gold/, p.assetType);
        assert.match(p.finalPrompt, /balanced highlights and darker reflective areas that keep the surface depth, so every motif and edge stays clearly visible/, p.assetType);
        assert.match(p.finalPrompt, /Never pale beige, lemon yellow, orange, copper, brown, black, burnt or overexposed metal/, p.assetType);
        assert.match(p.finalPrompt, /Apply this to the jewellery only — do not recolour the whole image/, p.assetType);
        assert.doesNotMatch(p.finalPrompt, /rich, warm, premium yellow gold|high mirror polish/, p.assetType);
      }
      for (const p of presenters(job)) {
        assert.match(p.finalPrompt, /Do not change the skin, clothing or background colours, and do not let the scene lighting turn the jewellery into a different gold tone/, p.assetType);
        assert.doesNotMatch(p.finalPrompt, /Use neutral white balance and keep the background pure white/, p.assetType);
      }
      for (const p of catalogue(job)) {
        assert.match(p.finalPrompt, /Use neutral white balance and keep the background pure white/, p.assetType);
        const elevated = /Elevated Detail gold: clean, bright, neutral yellow gold — never pale beige, orange, copper, black or burnt/;
        if (SHOT[p.assetType] === 3) {
          assert.match(p.finalPrompt, elevated, p.assetType);
          assert.match(p.finalPrompt, /realistic, polished highlights that never wash out the design/, p.assetType);
          assert.equal(p.metalColor, 'YELLOW');
        } else {
          assert.doesNotMatch(p.finalPrompt, elevated, p.assetType);
        }
      }
    }
  });

  test('gold validation compares with the reference: pale/orange/lost detail fails every image even with the right count and pose; reference-matched gold passes', () => {
    assert.equal(M.goldColour, 'The yellow-gold colour does not match the reference.');
    const bad = [
      [{ referenceMetalColourMatch: false }, M.goldColour],
      [{ washedOutMetal: true }, M.washedOutMetal],
      [{ orangeOrCopperCast: true }, M.orangeMetal],
      [{ metalDetailPreserved: false }, M.metalDetail],
    ];
    for (const [fields, message] of bad) {
      for (const shot of [1, 2, 3, 4]) assert.ok(failedWith(rule(SHOT_ASSET[shot], { ...CATALOGUE_OK[shot], ...fields }), message), `shot ${shot} ${message}`);
      for (const assetType of ['PRESENTER_YELLOW_1', 'PRESENTER_YELLOW_2']) assert.ok(failedWith(rule(assetType, { ...WORN_OK, ...fields }), message), assetType);
    }
    // Accurate, reference-matched gold passes (the defaults are a reference match).
    for (const shot of [1, 2, 3, 4]) assert.equal(rule(SHOT_ASSET[shot], CATALOGUE_OK[shot]).validationStatus, 'passed');
    // The reviewer compares with the reference, not the words "yellow gold".
    for (const p of bangleJob(PAIR)) {
      const text = buildValidationText({ confirmedType: 'BANGLE', metalColor: p.metalColor, assetType: p.assetType, bangleQuantity: PAIR });
      assert.match(text, /compare the jewellery's gold with the ORIGINAL reference's metal, not with the words "yellow gold"/);
      assert.match(text, /referenceMetalColourMatch = false if the hue, saturation, brightness or finish is materially different from the reference metal/);
    }
  });

  test('Slight Alternate Angle: one object per position, never two parallel rings; exact reference construction', () => {
    for (const p of catalogue(bangleJob(PAIR))) {
      const perPosition = /the left position holds exactly ONE complete bangle — one single closed band — and the right position holds exactly ONE complete bangle/;
      if (SHOT[p.assetType] === 2) {
        assert.match(p.finalPrompt, perPosition);
        assert.match(p.finalPrompt, /Each position contains only one object: never two parallel rings side by side, one behind the other or one inside the other at the same position/);
        assert.match(p.finalPrompt, /Preserve the exact band width, motifs, construction and proportions of one reference bangle/);
      } else {
        assert.doesNotMatch(p.finalPrompt, perPosition, p.assetType);
      }
    }
  });

  test('Macro Detail must be visibly closer, keep both bangles complete, and not repeat Image 2', () => {
    for (const job of allPairJobs()) {
      for (const p of catalogue(job)) {
        const close = /move the camera visibly closer than every other catalogue image — the primary bangle fills most of the frame height/;
        if (SHOT[p.assetType] === 4) {
          assert.match(p.finalPrompt, close, p.assetType);
          assert.match(p.finalPrompt, /motifs, band finish and construction are large, sharp and clearly readable/);
          assert.match(p.finalPrompt, /Keep both bangles complete inside the frame/);
          assert.match(p.finalPrompt, /Do not repeat the Slight Alternate Angle composition of two similar-sized upright bangles side by side/);
        } else {
          assert.doesNotMatch(p.finalPrompt, close, p.assetType);
        }
      }
    }
    // A Macro that is not visibly closer fails.
    const notClose = rule('YELLOW_MACRO', { ...CATALOGUE_OK[4], visiblyCloserDesignView: false });
    assert.ok(failedWith(notClose, 'The composition does not provide a visibly closer design view.'));
  });

  test('5. both presenter prompts require exactly one bangle per wrist, both wrists visible', () => {
    for (const job of allPairJobs()) {
      const shots = presenters(job);
      assert.equal(shots.length, 2);
      for (const p of shots) {
        assert.match(p.finalPrompt, /exactly one bangle on the left wrist and exactly one bangle on the right wrist/, p.assetType);
        assert.match(p.finalPrompt, /Exactly two bangles appear in the whole image: one on the left wrist and one on the right wrist/, p.assetType);
        assert.match(p.finalPrompt, /Never place both bangles on the same wrist, never stack the pair/, p.assetType);
        assert.match(p.finalPrompt, /neither hand may cover the other wrist or its bangle/, p.assetType);
        assert.match(p.finalPrompt, /do not add bracelets, watches, rings or any other jewellery/, p.assetType);
        assert.match(p.finalPrompt, /this image must contain exactly two physical bangles in total/, p.assetType);
      }
    }
  });

  test('6. Presenter Image 2 prohibits crossed wrists and holding one wrist; Presenter Image 1 keeps its pose', () => {
    const [first, second] = presenters(bangleJob(PAIR));
    assert.equal(second.assetType, 'PRESENTER_YELLOW_2');
    assert.match(second.finalPrompt, /one wrist slightly higher and the other slightly lower/i);
    assert.match(second.finalPrompt, /both wrists facing the camera/);
    assert.match(second.finalPrompt, /Do not cross the arms or wrists, do not hold one wrist with the other hand/);
    assert.match(second.finalPrompt, /never place both bangles on one wrist/);
    assert.match(second.finalPrompt, /both hands lowered in front of the body, away from the face and hair/);
    assert.match(second.finalPrompt, /each sitting at its wrist joint just above the hand — never pushed up the forearm or hanging loose/);
    // Image 1: the existing separated two-wrist pose, word for word.
    assert.match(
      first.finalPrompt,
      /Presenter Image 1 — two-wrist product-focused pose: a close, product-focused portrait composition showing both forearms, both hands and both wrists\. Keep the left and right wrists physically separated — do not cross the wrists, do not place one wrist directly behind the other, and do not let either hand touch or cover the face\./,
    );
    assert.doesNotMatch(first.finalPrompt, /alternate asymmetrical/);
  });
});

describe('Two-bangle set validation', () => {
  test('a correct pair passes on all six images', () => {
    for (const shot of [1, 2, 3, 4]) assert.equal(rule(SHOT_ASSET[shot], CATALOGUE_OK[shot]).validationStatus, 'passed', `shot ${shot}`);
    for (const assetType of ['PRESENTER_YELLOW_1', 'PRESENTER_YELLOW_2']) assert.equal(rule(assetType, WORN_OK).validationStatus, 'passed');
  });

  test('four physical bangles or a duplicated pair fail with the exact message', () => {
    assert.equal(M.pairFourGenerated, 'Expected exactly two physical bangles, but four were generated.');
    for (const shot of [2, 3, 4]) {
      const four = rule(SHOT_ASSET[shot], { ...CATALOGUE_OK[shot], physicalBangleCount: 4, bangleCount: 4 });
      assert.ok(failedWith(four, M.pairFourGenerated), `shot ${shot}`);
      assert.ok(!four.validationMessages.includes(`Failed: ${M.countMismatch}`), 'specific message replaces the generic one');
      assert.ok(failedWith(rule(SHOT_ASSET[shot], { ...CATALOGUE_OK[shot], duplicatedPairDetected: true }), M.pairFourGenerated));
    }
    assert.ok(failedWith(rule('PRESENTER_YELLOW_2', { ...WORN_OK, physicalBangleCount: 4 }), M.pairFourGenerated));
    assert.equal(banglePairCountMessage(3), 'Expected exactly two physical bangles, but three were generated.');
    assert.equal(banglePairCountMessage(1), 'Expected exactly two physical bangles, but only one was generated.');
  });

  test('fixture: two duplicated pairs = four objects and fail, even when the reviewer said two (Slight Alternate Angle, jobs 500c704c / 7b8b2ad5)', () => {
    const asReported = rule('YELLOW_SLIGHT_ANGLE', { ...CATALOGUE_OK[2], objectsByPosition: TWO_DUPLICATED_PAIRS, physicalBangleCount: 2, independentClosedBangleCount: 2 });
    assert.ok(failedWith(asReported, 'Expected exactly two physical bangles, but four were generated.'));
    for (const signal of [{ independentClosedBangleCount: 4 }, { duplicatedPairDetected: true }, { physicalBangleCount: 4 }]) {
      assert.ok(failedWith(rule('YELLOW_SLIGHT_ANGLE', { ...CATALOGUE_OK[2], ...signal }), M.pairFourGenerated), JSON.stringify(signal));
    }
    assert.ok(failedWith(rule('YELLOW_MACRO', { ...CATALOGUE_OK[4], independentClosedBangleCount: 3 }), 'Expected exactly two physical bangles, but three were generated.'));
  });

  test('fixture: one solid bangle\'s inner/outer edges count as one object; two solid bangles count as two', () => {
    // Two bangles with their inner walls visible (Macro, job 7b8b2ad5): two objects, passes.
    const macro = rule('YELLOW_MACRO', { ...CATALOGUE_OK[4], objectsByPosition: TWO_BANGLES_INNER_WALLS_VISIBLE, innerOuterEdgesMiscounted: true });
    assert.equal(macro.validationStatus, 'passed', JSON.stringify(macro.validationMessages));
    // One solid bangle shown with its inner and outer outline: one object.
    const one = rule('YELLOW_FRONT', { ...CATALOGUE_OK[1], objectsByPosition: SOLID_BANGLE_INNER_OUTER, physicalBangleCount: 1, independentClosedBangleCount: 1, bangleCount: 1 });
    assert.ok(failedWith(one, 'Expected exactly two physical bangles, but only one was generated.'));
    assert.ok(!one.validationMessages.some((m) => /four|three/.test(m)), 'inner/outer edges never counted as extra bangles');
    // Two solid bangles, Front and Slight Alternate Angle: pass as two.
    assert.equal(rule('YELLOW_FRONT', { ...CATALOGUE_OK[1], objectsByPosition: TWO_SOLID_BANGLES }).validationStatus, 'passed');
    assert.equal(rule('YELLOW_SLIGHT_ANGLE', { ...CATALOGUE_OK[2], objectsByPosition: TWO_SOLID_BANGLES }).validationStatus, 'passed');
    // A genuinely fused multi-rail design: its rails are one object.
    const fused = [
      { position: 'left', separateBandsAtPosition: 2, everyBandHasItsOwnDecoratedOuterFace: true, description: 'two rails fused into one rigid body' },
      { position: 'right', separateBandsAtPosition: 2, everyBandHasItsOwnDecoratedOuterFace: true, description: 'two rails fused into one rigid body' },
    ];
    assert.equal(rule('YELLOW_FRONT', { ...CATALOGUE_OK[1], objectsByPosition: fused, joinedMultiRailDesign: true }).validationStatus, 'passed');
  });

  test('expected outcomes for the six images of local job 7b8b2ad5', () => {
    const outcomes = {
      YELLOW_FRONT: rule('YELLOW_FRONT', { ...CATALOGUE_OK[1], objectsByPosition: TWO_SOLID_BANGLES }),
      YELLOW_SLIGHT_ANGLE: rule('YELLOW_SLIGHT_ANGLE', { ...CATALOGUE_OK[2], objectsByPosition: TWO_DUPLICATED_PAIRS, physicalBangleCount: 4, independentClosedBangleCount: 4, duplicatedPairDetected: true }),
      YELLOW_ELEVATED_DETAIL: rule('YELLOW_ELEVATED_DETAIL', { ...CATALOGUE_OK[3], objectsByPosition: TWO_SOLID_BANGLES }),
      YELLOW_MACRO: rule('YELLOW_MACRO', { ...CATALOGUE_OK[4], objectsByPosition: TWO_BANGLES_INNER_WALLS_VISIBLE, innerOuterEdgesMiscounted: true }),
      PRESENTER_YELLOW_1: rule('PRESENTER_YELLOW_1', WORN_OK),
      PRESENTER_YELLOW_2: rule('PRESENTER_YELLOW_2', { ...WORN_OK, banglesPerVisibleWrist: [2, 0], leftWristBangleCount: 2, rightWristBangleCount: 0 }),
    };
    assert.equal(outcomes.YELLOW_FRONT.validationStatus, 'passed');
    assert.ok(failedWith(outcomes.YELLOW_SLIGHT_ANGLE, M.pairFourGenerated));
    assert.equal(outcomes.YELLOW_ELEVATED_DETAIL.validationStatus, 'passed');
    assert.equal(outcomes.YELLOW_MACRO.validationStatus, 'passed');
    assert.equal(outcomes.PRESENTER_YELLOW_1.validationStatus, 'passed');
    assert.ok(failedWith(outcomes.PRESENTER_YELLOW_2, 'Both bangles were placed on the same wrist.'));
  });

  test('catalogue validation can never return presenter-only failures', () => {
    const presenterOnly = [M.setOnePerWrist, M.sameWrist, M.notVisible, M.otherJewellery, M.floating];
    // The Front Catalogue case from job 7b8b2ad5: reviewer flagged "hidden" plus wrist-shaped data and its own wrist message.
    const front = rule(
      'YELLOW_FRONT',
      { ...CATALOGUE_OK[1], requiredBangleHiddenOrCropped: true, visibleWristCount: 0, banglesPerVisibleWrist: [], otherWristJewellery: true, floatingIntersectingOrMisplaced: true },
      { validationMessages: ['Warning: One wrist is not clearly visible.', 'Note: two bangles on white.'] },
    );
    assert.ok(failedWith(front, M.catalogueHidden));
    for (const m of presenterOnly) assert.ok(!front.validationMessages.includes(`Failed: ${m}`), m);
    assert.ok(!front.validationMessages.some((m) => /wrist|hand/i.test(m)), JSON.stringify(front.validationMessages));
    assert.ok(front.validationMessages.includes('Note: two bangles on white.'));
    // Every catalogue shot, with every wrist-shaped field set wrong: no wrist failures.
    for (const shot of [1, 2, 3, 4]) {
      const r = rule(SHOT_ASSET[shot], { ...CATALOGUE_OK[shot], visibleWristCount: 0, banglesPerVisibleWrist: [2], leftWristBangleCount: 2, rightWristBangleCount: 0, otherWristJewellery: true, floatingIntersectingOrMisplaced: true });
      assert.equal(r.validationStatus, 'passed', `shot ${shot}: ${JSON.stringify(r.validationMessages)}`);
    }
    // The schemas themselves have no wrist fields for catalogue, and no shot fields for presenter.
    for (const p of bangleJob(PAIR)) {
      const text = buildValidationText({ confirmedType: 'BANGLE', metalColor: p.metalColor, assetType: p.assetType, bangleQuantity: PAIR });
      if (p.kind === 'catalogue') assert.match(text, /never report wrist, hand or bangle-per-wrist issues/);
      else assert.match(text, /This is a worn presenter image: evaluate quantity, that both wrists are visible, exactly one bangle on each wrist/);
    }
  });

  test('wrist rules still apply to presenter validation', () => {
    for (const assetType of ['PRESENTER_YELLOW_1', 'PRESENTER_YELLOW_2']) {
      const hidden = rule(assetType, { ...WORN_OK, requiredBangleHiddenOrCropped: true });
      assert.ok(failedWith(hidden, M.notVisible), assetType);
      assert.ok(!hidden.validationMessages.includes(`Failed: ${M.catalogueHidden}`));
      assert.ok(failedWith(rule(assetType, { ...WORN_OK, otherWristJewellery: true }), M.otherJewellery));
      assert.ok(failedWith(rule(assetType, { ...WORN_OK, floatingIntersectingOrMisplaced: true }), M.floating));
    }
  });

  test('both bangles on one wrist, or a missing wrist, fails the presenter images', () => {
    for (const assetType of ['PRESENTER_YELLOW_1', 'PRESENTER_YELLOW_2']) {
      const same = rule(assetType, { ...WORN_OK, leftWristBangleCount: 2, rightWristBangleCount: 0 });
      assert.ok(failedWith(same, 'Both bangles were placed on the same wrist.'), assetType);
      assert.ok(failedWith(same, 'Both wrists are required, with one bangle on each wrist.'), assetType);
      const missing = rule(assetType, { ...WORN_OK, visibleWristCount: 1, banglesPerVisibleWrist: [1], rightWristBangleCount: 0 });
      assert.ok(failedWith(missing, 'Both wrists are required, with one bangle on each wrist.'), assetType);
    }
  });

  test('a design that differs from the reference still fails', () => {
    assert.ok(failedWith(rule('YELLOW_MACRO', { ...CATALOGUE_OK[4], shapeAndDesignMatchReference: false }), M.design));
  });

  test('a reviewer "failed" is never turned into a pass', () => {
    const r = rule('YELLOW_FRONT', CATALOGUE_OK[1], { validationStatus: 'failed', validationMessages: ['Failed: something'] });
    assert.equal(r.validationStatus, 'failed');
  });
});

describe('Two-bangle set: regeneration, API calls and unchanged behaviour', () => {
  test('7. regeneration rebuilds the prompt with the corrected rules (one image call)', async () => {
    for (const p of bangleJob(PAIR)) {
      calls.length = 0;
      await generateShot({
        referenceBuffer: BUF,
        mimetype: 'image/jpeg',
        template: TEMPLATE,
        assetType: p.assetType,
        confirmedType: 'BANGLE',
        presenter: PRESENTER,
        presenterReferenceBuffer: BUF,
        generateRoseGold: false,
        outputSlot: { slotKey: p.slotKey, kind: p.kind, identity: p.identity },
        priorFailure: 'Failed: Expected exactly two physical bangles, but four were generated.',
        bangleQuantity: PAIR,
      });
      assert.equal(calls.length, 1, p.assetType);
      assert.equal(calls[0].kind, 'image');
      assert.match(calls[0].prompt, /this image must contain exactly two physical bangles in total/, p.assetType);
      if (p.assetType === 'PRESENTER_YELLOW_2') assert.match(calls[0].prompt, /do not hold one wrist with the other hand/);
      if (SHOT[p.assetType] === 3) assert.match(calls[0].prompt, /clean, bright, neutral yellow gold/);
      if (SHOT[p.assetType] === 2) assert.match(calls[0].prompt, /Each position contains only one object/);
      if (SHOT[p.assetType] === 4) assert.match(calls[0].prompt, /move the camera visibly closer than every other catalogue image/);
      assert.match(calls[0].prompt, /natural, polished yellow gold/, p.assetType);
    }
  });

  test('8 & 9. single-bangle, unknown-count and every non-Bangle prompt and validation text are byte-for-byte unchanged', () => {
    const now = computePromptHashes();
    assert.equal(Object.keys(now).length, Object.keys(BASELINE).length);
    let unchanged = 0;
    let pairChanged = 0;
    let necklaceCatalogueChanged = 0;
    for (const [key, before] of Object.entries(BASELINE)) {
      const after = now[key];
      assert.ok(after, key);
      if (before.type === 'BANGLE' && before.quantity === PAIR) {
        assert.notEqual(after.prompt, before.prompt, key);
        pairChanged += 1;
      } else if (before.type === 'NECKLACE' && before.kind === 'catalogue') {
        // Intended change (2026-11-16): Necklace catalogue images have their own four fixed shots.
        assert.notEqual(after.prompt, before.prompt, key);
        necklaceCatalogueChanged += 1;
      } else {
        assert.equal(after.prompt, before.prompt, key);
        assert.equal(after.validation, before.validation, key);
        unchanged += 1;
      }
    }
    assert.equal(pairChanged, 240);
    assert.equal(necklaceCatalogueChanged, 480);
    assert.equal(unchanged, 8640);
  });

  test('10. six images per job, one image call per image, one validation call with the pair schema', async () => {
    for (const job of allPairJobs()) assert.equal(job.length, 6);
    const kinds = {
      1: 'generation_validation_bangle_pair_catalogue',
      2: 'generation_validation_bangle_pair_catalogue_upright',
      3: 'generation_validation_bangle_pair_catalogue',
      4: 'generation_validation_bangle_pair_catalogue_upright',
    };
    const COMMON = ['objectsByPosition', 'physicalBangleCount', 'independentClosedBangleCount', 'visualGroupCount', 'expectedPhysicalCount', 'actualPhysicalCount', 'eachReferenceDesignShownOnce', 'duplicatedPairDetected', 'joinedMultiRailDesign', 'innerOuterEdgesMiscounted', 'referenceMetalColourMatch', 'washedOutMetal', 'orangeOrCopperCast', 'metalDetailPreserved'];
    const WRIST = ['visibleWristCount', 'banglesPerVisibleWrist', 'otherWristJewellery', 'floatingIntersectingOrMisplaced', 'leftWristBangleCount', 'rightWristBangleCount'];
    const SHOT_ONLY = ['observedShotType', 'observedCameraAngle', 'observedArrangement', 'productsTouchOrOverlap'];
    for (const shot of [1, 2, 3, 4]) {
      calls.length = 0;
      chatReply = pairReview(CATALOGUE_OK[shot]);
      const result = await validateGeneratedImage({
        generatedBuffer: BUF, referenceBuffer: BUF, referenceMimetype: 'image/jpeg',
        confirmedType: 'BANGLE', metalColor: 'YELLOW', assetType: SHOT_ASSET[shot], bangleQuantity: PAIR,
      });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].body.response_format.json_schema.name, kinds[shot]);
      const props = calls[0].body.response_format.json_schema.schema.properties.bangleCheck.properties;
      for (const f of COMMON) assert.ok(props[f], `${f} on shot ${shot}`);
      for (const f of WRIST) assert.ok(!props[f], `catalogue shot ${shot} must not ask for ${f}`);
      for (const f of SHOT_ONLY) assert.ok(props[f], `${f} on shot ${shot}`);
      assert.equal(Object.keys(props)[0], 'objectsByPosition', 'positions are described before any count');
      assert.equal(result.validationStatus, 'passed', `shot ${shot}`);
    }
    // A four-bangle presenter image fails through the real validation path.
    calls.length = 0;
    chatReply = pairReview({ ...WORN_OK, physicalBangleCount: 4, bangleCount: 4, leftWristBangleCount: 2, rightWristBangleCount: 2 });
    const worn = await validateGeneratedImage({
      generatedBuffer: BUF, referenceBuffer: BUF, referenceMimetype: 'image/jpeg',
      confirmedType: 'BANGLE', metalColor: 'YELLOW', assetType: 'PRESENTER_YELLOW_2', bangleQuantity: PAIR,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.response_format.json_schema.name, 'generation_validation_bangle_pair_presenter');
    const wornProps = calls[0].body.response_format.json_schema.schema.properties.bangleCheck.properties;
    for (const f of [...COMMON, ...WRIST]) assert.ok(wornProps[f], `presenter needs ${f}`);
    for (const f of SHOT_ONLY) assert.ok(!wornProps[f], `presenter must not ask for ${f}`);
    assert.ok(failedWith(worn, M.pairFourGenerated));
  });

  test('single-bangle and unknown-count validation keep their existing schemas', async () => {
    const expected = [
      ['SINGLE_BANGLE', 'YELLOW_FRONT', 'generation_validation_bangle'],
      ['SINGLE_BANGLE', 'YELLOW_SLIGHT_ANGLE', 'generation_validation_bangle_upright'],
      ['SINGLE_BANGLE', 'YELLOW_ELEVATED_DETAIL', 'generation_validation_bangle_single_detail'],
      ['SINGLE_BANGLE', 'YELLOW_MACRO', 'generation_validation_bangle_single_detail'],
      ['SINGLE_BANGLE', 'PRESENTER_YELLOW_1', 'generation_validation_bangle'],
      [null, 'YELLOW_ELEVATED_DETAIL', 'generation_validation_bangle'],
      [null, 'YELLOW_MACRO', 'generation_validation_bangle_upright'],
    ];
    for (const [bangleQuantity, assetType, name] of expected) {
      calls.length = 0;
      chatReply = {};
      await validateGeneratedImage({
        generatedBuffer: BUF, referenceBuffer: BUF, referenceMimetype: 'image/jpeg',
        confirmedType: 'BANGLE', metalColor: 'YELLOW', assetType, bangleQuantity,
      }).catch(() => {});
      assert.equal(calls.length, 1);
      assert.equal(calls[0].body.response_format.json_schema.name, name, `${bangleQuantity} ${assetType}`);
      assert.ok(!calls[0].body.response_format.json_schema.schema.properties.bangleCheck.properties.physicalBangleCount);
    }
  });
});
