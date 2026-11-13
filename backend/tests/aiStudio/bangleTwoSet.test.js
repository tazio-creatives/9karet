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
      leftWristBangleCount: 0,
      rightWristBangleCount: 0,
      duplicatedPairDetected: false,
      splitRailDetected: false,
      goldColourCorrect: true,
      ringsPerBangleInReference: 1,
      separateRingCount: 2,
      ...check,
    },
  };
}
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
        assert.match(p.finalPrompt, /this image must contain exactly two physical bangles in total — no more and no fewer/, p.assetType);
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

  test('2. one bangle = one piece of the reference: a stacked reference pair is never copied as one doubled bangle; genuine rails stay one bangle', () => {
    for (const job of allPairJobs()) {
      for (const p of job) {
        assert.match(p.finalPrompt, /each individual bangle is only one of the two pieces in it/, p.assetType);
        assert.match(p.finalPrompt, /if the reference shows two bands together, each bangle is a single band/, p.assetType);
        assert.match(p.finalPrompt, /Never copy the stacked look of the reference pair as the design of one bangle, never draw a bangle as two bands or a doubled ring/, p.assetType);
        assert.match(p.finalPrompt, /Rails, borders or decorative bands that one single piece in the reference genuinely has stay part of that one bangle — never split such a piece into separate bangles/, p.assetType);
        assert.match(p.finalPrompt, /never create extra bangles through reflections, shadows or background objects/, p.assetType);
        assert.doesNotMatch(p.finalPrompt, /A bangle may have several rails/, p.assetType);
      }
    }
    // The reviewer derives one bangle from the reference the same way.
    for (const p of bangleJob(PAIR)) {
      const text = buildValidationText({ confirmedType: 'BANGLE', metalColor: p.metalColor, assetType: p.assetType, bangleQuantity: PAIR });
      assert.match(text, /count physical jewellery objects, not rails or decorative borders/);
      assert.match(text, /if the reference shows two bands, each bangle is ONE single band/);
      assert.match(text, /two bands stacked together on one wrist, or drawn side by side as one unit, count as TWO; a genuinely multi-rail reference piece counts once/);
      assert.match(text, /Two separate single-band bangles placed apart, as in the reference, are correct: never report them as one stacked or merged bangle/);
    }
  });

  test('3. Images 2–4 prohibit two duplicated pairs and four loops; Image 1 keeps its negatives', () => {
    const NO_DUP = 'Do not draw either bangle as two bands or a doubled ring, and do not show two duplicated pairs, four loops or four rings.';
    for (const job of allPairJobs()) {
      for (const p of catalogue(job)) {
        const shot = SHOT[p.assetType];
        if (shot === 1) assert.ok(!p.negativeInstructions.includes(NO_DUP), p.assetType);
        else assert.ok(p.negativeInstructions.includes(NO_DUP), p.assetType);
        assert.match(p.finalPrompt, /never show two pairs, four loops or four rings/, p.assetType);
      }
    }
    const [, angle, elevated, macro] = catalogue(bangleJob(PAIR));
    assert.match(angle.finalPrompt, /do not turn either bangle into a pair/);
    assert.match(elevated.finalPrompt, /neither position may hold a duplicated pair/);
    assert.match(macro.finalPrompt, /must never display four loops or two duplicated pairs/);
  });

  test('4. every pair image asks for rich polished gold (design from the reference, not its dull colour); Elevated Detail adds the clean-yellow check', () => {
    for (const job of allPairJobs()) {
      for (const p of job) {
        assert.match(p.finalPrompt, /rich, warm, premium yellow gold with a high mirror polish/, p.assetType);
        assert.match(p.finalPrompt, /never pale lemon, butter-yellow, greenish, beige, orange, copper, brown, black or burnt/, p.assetType);
        assert.match(p.finalPrompt, /take only the design from it — not its dull colour or lighting/, p.assetType);
      }
      for (const p of catalogue(job)) {
        const elevated = /Elevated Detail gold: this image is checked for clean, bright, neutral yellow gold — never pale beige, orange, copper, black or burnt/;
        if (SHOT[p.assetType] === 3) {
          assert.match(p.finalPrompt, elevated, p.assetType);
          assert.match(p.finalPrompt, /realistic, polished highlights that never wash out the design/, p.assetType);
          assert.equal(p.metalColor, 'YELLOW');
        } else {
          assert.doesNotMatch(p.finalPrompt, elevated, p.assetType);
        }
      }
    }
    // Image 2 spells the ring count out position by position.
    for (const p of catalogue(bangleJob(PAIR))) {
      const ringCount = /the left position holds exactly ONE single bangle ring and the right position holds exactly ONE single bangle ring/;
      if (SHOT[p.assetType] === 2) assert.match(p.finalPrompt, ringCount);
      else assert.doesNotMatch(p.finalPrompt, ringCount, p.assetType);
    }
    // Validation: wrong gold fails Elevated Detail only.
    assert.ok(failedWith(rule('YELLOW_ELEVATED_DETAIL', { ...CATALOGUE_OK[3], goldColourCorrect: false }), M.goldColour));
    assert.equal(M.goldColour, 'The yellow-gold colour does not match the reference.');
    assert.equal(rule('YELLOW_FRONT', { ...CATALOGUE_OK[1], goldColourCorrect: false }).validationStatus, 'passed');
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

  test('four literal rings fail even when the reviewer called them two bangles (local job f1356633, Image 2)', () => {
    const doubled = rule('YELLOW_SLIGHT_ANGLE', { ...CATALOGUE_OK[2], physicalBangleCount: 2, separateRingCount: 4, ringsPerBangleInReference: 1 });
    assert.ok(failedWith(doubled, M.pairFourGenerated));
    // A genuinely two-rail design: 4 rings = 2 bangles, passes.
    assert.equal(rule('YELLOW_SLIGHT_ANGLE', { ...CATALOGUE_OK[2], separateRingCount: 4, ringsPerBangleInReference: 2 }).validationStatus, 'passed');
    assert.ok(failedWith(rule('PRESENTER_YELLOW_1', { ...WORN_OK, separateRingCount: 4 }), M.pairFourGenerated));
    assert.ok(failedWith(rule('YELLOW_FRONT', { ...CATALOGUE_OK[1], separateRingCount: 1 }), 'Expected exactly two physical bangles, but only one was generated.'));
  });

  test('a split multi-rail design fails', () => {
    assert.equal(M.splitRail, 'A multi-rail bangle design was incorrectly split into separate bangles.');
    for (const shot of [1, 2, 3, 4]) assert.ok(failedWith(rule(SHOT_ASSET[shot], { ...CATALOGUE_OK[shot], splitRailDetected: true }), M.splitRail));
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
    }
  });

  test('8 & 9. single-bangle, unknown-count and every non-Bangle prompt and validation text are byte-for-byte unchanged', () => {
    const now = computePromptHashes();
    assert.equal(Object.keys(now).length, Object.keys(BASELINE).length);
    let unchanged = 0;
    let pairChanged = 0;
    for (const [key, before] of Object.entries(BASELINE)) {
      const after = now[key];
      assert.ok(after, key);
      if (before.type === 'BANGLE' && before.quantity === PAIR) {
        assert.notEqual(after.prompt, before.prompt, key);
        pairChanged += 1;
      } else {
        assert.equal(after.prompt, before.prompt, key);
        assert.equal(after.validation, before.validation, key);
        unchanged += 1;
      }
    }
    assert.equal(pairChanged, 240);
    assert.equal(unchanged, 9120);
  });

  test('10. six images per job, one image call per image, one validation call with the pair schema', async () => {
    for (const job of allPairJobs()) assert.equal(job.length, 6);
    const kinds = { 1: 'generation_validation_bangle_pair', 2: 'generation_validation_bangle_pair_upright', 3: 'generation_validation_bangle_pair', 4: 'generation_validation_bangle_pair_upright' };
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
      for (const f of ['physicalBangleCount', 'leftWristBangleCount', 'rightWristBangleCount', 'duplicatedPairDetected', 'splitRailDetected', 'goldColourCorrect', 'ringsPerBangleInReference', 'separateRingCount']) {
        assert.ok(props[f], `${f} on shot ${shot}`);
      }
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
    assert.equal(calls[0].body.response_format.json_schema.name, 'generation_validation_bangle_pair');
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
