// Two-bangle sets by set type: identical pairs (one AI bangle + a local,
// identical second copy on catalogue images), distinct pairs (both designs
// generated together), and older jobs (no set type: existing flow).
// OpenAI is replaced by a fetch stub and the queue is stubbed — nothing here
// makes a network or paid call. The job test uses the throwaway test DB and
// a temporary upload folder.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

process.env.OPENAI_API_KEY = 'sk-test';
process.env.OPENAI_VISION_MODEL = 'vision-test';
process.env.OPENAI_IMAGE_MODEL = 'image-test';
const UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ninekaret-bangle-composite-'));
process.env.UPLOAD_DIR = UPLOAD_DIR;
process.env.UPLOADS_PUBLIC_BASE_URL = 'http://localhost:6002/uploads';

const svc = await import('../../src/services/aiStudioService.js');
const { composeIdenticalPair, isolateSingleBangle, metalMask, metalObjects, COMPOSITE_LAYOUTS } =
  await import('../../src/services/bangleComposite.js');
const { TEMPLATE, PRESENTER } = await import('./helpers/promptHashes.mjs');
const { query } = await import('../../src/config/db.js');
const { boss } = await import('../../src/jobs/queue.js');
const { insertJob, findAssetsByJobId } =
  await import('../../src/repositories/aiStudio.repository.js');
const { confirmJob } = await import('../../src/controllers/aiStudio.controller.js');
const { generateHandler } = await import('../../src/jobs/aiStudioJob.js');
const { storageProvider } = await import('../../src/providers/storage/index.js');

const M = svc.BANGLE_VALIDATION_MESSAGES;
const PAIR = 'TWO_BANGLE_SET';
const FIXTURES = new URL('./fixtures/bangle-composite/', import.meta.url);

// --- synthetic images -------------------------------------------------------
// Gold rings on white with a soft grey contact shadow and darker gold motifs.
const GOLD = '#d4a43a';
const MOTIF = '#9c6f1c';
function ringSvg(rings, { size = 1024 } = {}) {
  const parts = rings.map(({ cx, cy, rx, ry, w = 26 }) => {
    const motifs = [0, 1, 2, 3, 4, 5]
      .map((k) => {
        const t = (Math.PI / 3) * k + 0.4;
        return `<circle cx="${cx + rx * Math.cos(t)}" cy="${cy + ry * Math.sin(t)}" r="7" fill="${MOTIF}"/>`;
      })
      .join('');
    return `<ellipse cx="${cx}" cy="${cy + ry + 14}" rx="${rx * 0.8}" ry="10" fill="#dcdcdc"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${GOLD}" stroke-width="${w}"/>${motifs}`;
  });
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#fbfbfb"/>${parts.join('')}</svg>`,
  );
}
const png = async (svg) => sharp(svg).png().toBuffer();
// One bangle per shot, in each shot's pose and size.
const SINGLE = {
  1: [{ cx: 512, cy: 480, rx: 420, ry: 90 }],
  2: [{ cx: 512, cy: 470, rx: 150, ry: 380 }],
  3: [{ cx: 512, cy: 480, rx: 300, ry: 85 }],
  4: [{ cx: 512, cy: 490, rx: 200, ry: 440 }],
};
// A source that is a doubled pair with a visible gap (two separate rings).
const DOUBLED_WITH_GAP = [
  { cx: 400, cy: 470, rx: 100, ry: 380 },
  { cx: 650, cy: 470, rx: 100, ry: 380 },
];

async function rawOf(buffer) {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
async function objectsIn(buffer) {
  const { data, width, height } = await rawOf(buffer);
  return metalObjects(metalMask(data, width, height, 3), width, height);
}

// --- fetch stub ---------------------------------------------------------------
const calls = [];
let imageReply = null;
let chatReply = () => ({});
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (init?.body instanceof FormData) {
    calls.push({ kind: 'image', url: u, prompt: init.body.get('prompt') });
    return new Response(JSON.stringify({ data: [{ b64_json: imageReply.toString('base64') }] }), {
      headers: { 'content-type': 'application/json' },
    });
  }
  const body = JSON.parse(init.body);
  calls.push({ kind: 'chat', url: u, body });
  return new Response(
    JSON.stringify({
      id: 'x',
      object: 'chat.completion',
      created: 0,
      model: 'v',
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: { role: 'assistant', content: JSON.stringify(chatReply(body)), refusal: null },
        },
      ],
    }),
    { headers: { 'content-type': 'application/json' } },
  );
};
beforeEach(() => {
  calls.length = 0;
});

// A complete, passing reviewer answer for a two-bangle image; fields that
// the schema in use does not have are ignored by the parser.
const SHOT_OK = {
  YELLOW_FRONT: { observedShotType: 'FRONT_HORIZONTAL' },
  YELLOW_SLIGHT_ANGLE: {
    observedShotType: 'UPRIGHT_THREE_QUARTER',
    visiblyCloserDesignView: false,
  },
  YELLOW_ELEVATED_DETAIL: { observedShotType: 'LOW_SIDE_DEPTH' },
  YELLOW_MACRO: { observedShotType: 'UPRIGHT_CLOSE_DETAIL', visiblyCloserDesignView: true },
};
const SOURCE_OK = {
  physicalBangleCount: 1,
  doubledPairOrParallelDuplicate: false,
  designMatchesReference: true,
  referenceMetalColourMatch: true,
  washedOutMetal: false,
  orangeOrCopperCast: false,
  requiredShotCorrect: true,
  backgroundPureWhite: true,
};
function review(assetType, { check = {}, source = SOURCE_OK, base = {} } = {}) {
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
      objectsByPosition: [
        {
          position: 'left',
          separateBandsAtPosition: 1,
          everyBandHasItsOwnDecoratedOuterFace: true,
          description: 'one bangle',
        },
        {
          position: 'right',
          separateBandsAtPosition: 1,
          everyBandHasItsOwnDecoratedOuterFace: true,
          description: 'one bangle',
        },
      ],
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
      anyBangleLyingFlat: false,
      allBanglesStandingUpright: true,
      primaryBangleUpright: true,
      topDownView: false,
      visiblyCloserDesignView: true,
      backgroundPureWhite: true,
      physicalBangleCount: 2,
      independentClosedBangleCount: 2,
      visualGroupCount: 2,
      expectedPhysicalCount: 2,
      actualPhysicalCount: 2,
      duplicatedPairDetected: false,
      joinedMultiRailDesign: false,
      innerOuterEdgesMiscounted: false,
      eachReferenceDesignShownOnce: true,
      referenceMetalColourMatch: true,
      washedOutMetal: false,
      orangeOrCopperCast: false,
      metalDetailPreserved: true,
      leftWristBangleCount: 1,
      rightWristBangleCount: 1,
      ...(SHOT_OK[assetType] ?? {}),
      ...check,
    },
    ...(source ? { sourceCheck: source } : {}),
  };
}
const assetTypeFrom = (body) =>
  /Asset type: ([A-Z_0-9]+)/.exec(body.messages[1].content[0].text)?.[1];

function bangleJob(bangleQuantity, bangleSetType, opts = {}) {
  return svc.previewPromptsForJob({
    confirmedType: opts.type ?? 'BANGLE',
    template: TEMPLATE,
    presenter: PRESENTER,
    generateRoseGold: opts.rose ?? false,
    confirmedCustomerCategory: opts.customer,
    references: opts.references ?? { angle45: false, side: false },
    bangleQuantity,
    bangleSetType,
  });
}

describe('analysis: bangleSetType in the existing call', () => {
  test('the one analysis request asks for bangleSetType; set type is only derived for a Bangle two-bangle set', async () => {
    chatReply = () => ({});
    await svc.analyseJewellery(Buffer.from('x'), 'image/jpeg').catch(() => {});
    assert.equal(calls.length, 1, 'still exactly one analysis request');
    const { body } = calls[0];
    assert.deepEqual(body.response_format.json_schema.schema.properties.bangleSetType.enum, [
      'IDENTICAL_PAIR',
      'DISTINCT_PAIR',
      'NOT_APPLICABLE',
    ]);
    assert.match(
      body.messages[0].content,
      /IDENTICAL_PAIR when the photo shows exactly two bangles with the same design, DISTINCT_PAIR when it shows exactly two bangles whose designs differ, and NOT_APPLICABLE/,
    );

    const pair = (t) => ({ wristPieceCount: 2, bangleSetType: t });
    assert.equal(svc.bangleSetTypeForJob('BANGLE', pair('IDENTICAL_PAIR')), 'IDENTICAL_PAIR');
    assert.equal(
      svc.bangleSetTypeForJob('BANGLE', JSON.stringify(pair('DISTINCT_PAIR'))),
      'DISTINCT_PAIR',
    );
    assert.equal(svc.bangleSetTypeForJob('BANGLE', pair('NOT_APPLICABLE')), null);
    assert.equal(
      svc.bangleSetTypeForJob('BANGLE', { wristPieceCount: 1, bangleSetType: 'IDENTICAL_PAIR' }),
      null,
      'single bangle never composites',
    );
    assert.equal(
      svc.bangleSetTypeForJob('BRACELET', pair('IDENTICAL_PAIR')),
      null,
      'other categories never get a set type',
    );
    assert.equal(
      svc.bangleSetTypeForJob('BANGLE', { wristPieceCount: 2 }),
      null,
      'older jobs keep the existing flow',
    );
  });
});

describe('bangleComposite: one generated bangle becomes exactly two', () => {
  test('1/4. every catalogue shot: one source bangle → exactly two objects, layout as specified, never mirrored', async () => {
    for (const shot of [1, 2, 3, 4]) {
      const source = await png(ringSvg(SINGLE[shot]));
      assert.equal((await objectsIn(source)).length, 1);
      const r = await composeIdenticalPair(source, shot);
      assert.ok(r.ok, `shot ${shot}: ${r.reason}`);
      assert.equal(r.metadata.copies, 2);
      assert.equal(r.metadata.mirrored, false);
      assert.equal(r.metadata.layout, COMPOSITE_LAYOUTS[shot].name);
      const objects = await objectsIn(r.buffer);
      assert.equal(objects.length, 2, `shot ${shot}`);
      const [a, b] = r.metadata.placements;
      if (shot === 1) assert.ok(b.top > a.top + a.height, 'front: one above, one below');
      else {
        assert.ok(b.left > a.left, 'second copy to the right');
        assert.ok(
          b.width * b.height < a.width * a.height,
          'second copy is the smaller background copy',
        );
      }
    }
  });

  test('3. Slight Alternate: two upright objects, left foreground and right background', async () => {
    const r = await composeIdenticalPair(await png(ringSvg(SINGLE[2])), 2);
    assert.ok(r.ok);
    const objects = (await objectsIn(r.buffer)).sort((p, q) => p.x0 - q.x0);
    assert.equal(objects.length, 2);
    for (const o of objects)
      assert.ok(o.y1 - o.y0 > 1.5 * (o.x1 - o.x0), 'upright: taller than wide');
    assert.ok(objects[0].y1 >= objects[1].y1, 'left copy sits lower (foreground)');
  });

  test('2. a doubled source never composites: no third or fourth bangle can enter', async () => {
    const doubled = await composeIdenticalPair(await png(ringSvg(DOUBLED_WITH_GAP)), 2);
    assert.equal(doubled.ok, false);
    assert.match(doubled.reason, /contains 2 separate bangle-sized objects instead of exactly one/);
    assert.equal(doubled.buffer, undefined);
    const empty = await composeIdenticalPair(
      await png(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#fff"/></svg>',
        ),
      ),
      1,
    );
    assert.equal(empty.ok, false);
    const grey = await composeIdenticalPair(
      await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#707070' } })
        .png()
        .toBuffer(),
      1,
    );
    assert.equal(grey.ok, false);
    assert.match(grey.reason, /clean light background/);
  });

  test('5. gold pixels are unchanged: the full-size copy is pixel-identical; the smaller copy keeps the gold colour', async () => {
    for (const file of ['real-elevated-single.png', 'real-upright-single.png']) {
      const source = fs.readFileSync(new URL(file, FIXTURES));
      const shot = file.includes('elevated') ? 3 : 4;
      const iso = await isolateSingleBangle(source);
      assert.ok(iso.ok, iso.reason);
      const r = await composeIdenticalPair(source, shot);
      assert.ok(r.ok, r.reason);
      const final = await rawOf(r.buffer);
      const src = await rawOf(source);
      const [primary, secondary] = r.metadata.placements;
      // Every metal pixel of the source sits unchanged in the final image.
      let compared = 0;
      const { crop, origin } = iso;
      for (let y = 0; y < crop.height; y++) {
        for (let x = 0; x < crop.width; x++) {
          if (!crop.mask[y * crop.width + x]) continue;
          if (primary.scale !== 1) continue;
          const s = ((origin.y + y) * src.width + (origin.x + x)) * 3;
          const d = ((primary.top + y) * final.width + (primary.left + x)) * 3;
          assert.deepEqual(
            [final.data[d], final.data[d + 1], final.data[d + 2]],
            [src.data[s], src.data[s + 1], src.data[s + 2]],
          );
          compared += 1;
        }
      }
      if (primary.scale === 1)
        assert.ok(compared > 5000, `${file}: ${compared} metal pixels compared`);
      // Mean gold colour of the resampled background copy stays within 3 levels.
      const mean = (img, box) => {
        let n = 0;
        const sum = [0, 0, 0];
        for (let y = box.top; y < box.top + box.height; y++) {
          for (let x = box.left; x < box.left + box.width; x++) {
            const p = (y * img.width + x) * 3;
            const mx = Math.max(img.data[p], img.data[p + 1], img.data[p + 2]);
            if (
              mx > 60 &&
              (mx - Math.min(img.data[p], img.data[p + 1], img.data[p + 2])) / mx > 0.35
            ) {
              sum[0] += img.data[p];
              sum[1] += img.data[p + 1];
              sum[2] += img.data[p + 2];
              n += 1;
            }
          }
        }
        return sum.map((v) => v / n);
      };
      const before = mean(src, {
        left: origin.x,
        top: origin.y,
        width: crop.width,
        height: crop.height,
      });
      const after = mean(final, secondary);
      for (let c = 0; c < 3; c++)
        assert.ok(
          Math.abs(before[c] - after[c]) <= 3,
          `${file} channel ${c}: ${before[c]} vs ${after[c]}`,
        );
    }
  });

  test('6. background masking never removes gold edges or motifs', async () => {
    const source = await png(ringSvg(SINGLE[3]));
    const before = await rawOf(source);
    const metalBefore = metalMask(before.data, before.width, before.height, 3).reduce(
      (a, b) => a + b,
      0,
    );
    const iso = await isolateSingleBangle(source);
    assert.ok(iso.ok);
    const metalInCrop = iso.crop.mask.reduce((a, b) => a + b, 0);
    assert.equal(
      metalInCrop,
      metalBefore,
      'every gold pixel (edges and motifs) survives isolation',
    );
    // The darker motif colour is still present, unchanged, in the final image.
    const r = await composeIdenticalPair(source, 3);
    const final = await rawOf(r.buffer);
    let motifPixels = 0;
    for (let i = 0; i < final.width * final.height; i++) {
      const p = i * 3;
      if (final.data[p] === 0x9c && final.data[p + 1] === 0x6f && final.data[p + 2] === 0x1c)
        motifPixels += 1;
    }
    assert.ok(motifPixels > 200, `motif pixels in final: ${motifPixels}`);
    // Background is pure white away from the bangles and shadows.
    assert.deepEqual([final.data[0], final.data[1], final.data[2]], [255, 255, 255]);
  });
});

describe('prompts by set type', () => {
  test('identical pair: catalogue asks the AI for exactly ONE bangle (with the admin note); presenters are the normal two-wrist prompts', () => {
    const identical = bangleJob(PAIR, 'IDENTICAL_PAIR');
    const older = bangleJob(PAIR, undefined);
    assert.equal(identical.length, 6);
    for (const p of identical.filter((x) => x.kind === 'catalogue')) {
      assert.equal(
        p.adminNote,
        'AI generates one verified bangle; the system creates the second identical catalogue copy locally.',
      );
      assert.match(p.finalPrompt, /Generate exactly ONE of them — one physical bangle/);
      assert.match(p.finalPrompt, /Show exactly ONE complete bangle/);
      assert.match(p.finalPrompt, /The second identical bangle is added afterwards by the system/);
      assert.doesNotMatch(p.finalPrompt, /this image must contain exactly two physical bangles/);
    }
    // Presenter images are never composited: identical-pair presenter prompts equal the existing pair prompts.
    const pres = (list) => list.filter((x) => x.kind === 'presenter').map((x) => x.finalPrompt);
    assert.deepEqual(pres(identical), pres(older));
    for (const p of identical.filter((x) => x.kind === 'presenter')) {
      assert.equal(p.adminNote, undefined);
      assert.match(
        p.finalPrompt,
        /exactly one bangle on the left wrist and exactly one bangle on the right wrist/,
      );
    }
  });

  test('distinct pair: both designs, each exactly once, on catalogue and presenter images; no local copy', () => {
    for (const p of bangleJob(PAIR, 'DISTINCT_PAIR')) {
      assert.equal(p.adminNote, undefined);
      assert.match(p.finalPrompt, /two reference bangles have DIFFERENT designs/, p.assetType);
      assert.match(p.finalPrompt, /never two copies of the same design/, p.assetType);
      if (p.kind === 'catalogue')
        assert.match(p.finalPrompt, /this image must contain exactly two physical bangles/);
    }
  });

  test('older jobs (no set type), single bangles and every other category are unchanged by the set type', () => {
    const types = svc.JEWELLERY_TYPES;
    for (const type of types) {
      for (const q of [undefined, 'SINGLE_BANGLE', PAIR]) {
        if (type === 'BANGLE' && q === PAIR) continue;
        for (const st of ['IDENTICAL_PAIR', 'DISTINCT_PAIR']) {
          const a = bangleJob(q, undefined, { type }).map((p) => p.finalPrompt);
          const b = bangleJob(q, st, { type }).map((p) => p.finalPrompt);
          assert.deepEqual(b, a, `${type} ${q} ${st}`);
        }
      }
    }
  });
});

describe('validation: source and final composite in ONE request', () => {
  const BUF = Buffer.from('x');
  const validate = (assetType, extra) =>
    svc.validateGeneratedImage({
      generatedBuffer: BUF,
      referenceBuffer: BUF,
      referenceMimetype: 'image/jpeg',
      confirmedType: 'BANGLE',
      metalColor: 'YELLOW',
      assetType,
      bangleQuantity: PAIR,
      ...extra,
    });

  test('one request carries final (1st), reference (2nd) and source (3rd); the reviewer checks them separately', async () => {
    for (const assetType of [
      'YELLOW_FRONT',
      'YELLOW_SLIGHT_ANGLE',
      'YELLOW_ELEVATED_DETAIL',
      'YELLOW_MACRO',
    ]) {
      calls.length = 0;
      chatReply = () => review(assetType);
      const r = await validate(assetType, {
        bangleSetType: 'IDENTICAL_PAIR',
        compositeSourceBuffer: Buffer.from('source'),
      });
      assert.equal(calls.length, 1, 'one validation request');
      const { body } = calls[0];
      const images = body.messages[1].content.filter((c) => c.type === 'image_url');
      assert.equal(images.length, 3);
      assert.equal(
        images[2].image_url.url,
        `data:image/png;base64,${Buffer.from('source').toString('base64')}`,
      );
      assert.match(
        body.response_format.json_schema.name,
        /^generation_validation_bangle_pair_composite/,
      );
      assert.ok(body.response_format.json_schema.schema.properties.sourceCheck);
      assert.match(body.messages[1].content[0].text, /sourceCheck — judge the THIRD image only/);
      assert.match(
        body.messages[1].content[0].text,
        /bangleCheck — judge the FIRST \(final\) image only/,
      );
      assert.equal(r.validationStatus, 'passed', JSON.stringify(r.validationMessages));
    }
  });

  test('a failing source fails the whole output even when the final composite looks right', async () => {
    const bad = [
      [{ doubledPairOrParallelDuplicate: true }, M.sourceDoubled],
      [{ physicalBangleCount: 2 }, M.sourceCount],
      [{ designMatchesReference: false }, M.sourceDesign],
      [{ orangeOrCopperCast: true }, M.sourceGold],
      [{ requiredShotCorrect: false }, M.sourceShot],
    ];
    for (const [fields, message] of bad) {
      chatReply = () => review('YELLOW_SLIGHT_ANGLE', { source: { ...SOURCE_OK, ...fields } });
      const r = await validate('YELLOW_SLIGHT_ANGLE', {
        bangleSetType: 'IDENTICAL_PAIR',
        compositeSourceBuffer: BUF,
      });
      assert.equal(r.validationStatus, 'failed', message);
      assert.ok(r.validationMessages.includes(`Failed: ${message}`), message);
    }
    // A failing final fails too — 7. four loops in two groups are four.
    chatReply = () =>
      review('YELLOW_SLIGHT_ANGLE', { check: { visualGroupCount: 2, actualPhysicalCount: 4 } });
    const four = await validate('YELLOW_SLIGHT_ANGLE', {
      bangleSetType: 'IDENTICAL_PAIR',
      compositeSourceBuffer: BUF,
    });
    assert.ok(
      four.validationMessages.includes(
        'Failed: Expected exactly two physical bangles, but four were generated.',
      ),
    );
  });

  test('without a composite source, identical-pair and other images keep their normal schemas (no third image)', async () => {
    chatReply = () => review('YELLOW_FRONT', { source: null });
    await validate('YELLOW_FRONT', { bangleSetType: 'IDENTICAL_PAIR' });
    assert.equal(
      calls[0].body.response_format.json_schema.name,
      'generation_validation_bangle_pair_catalogue',
    );
    assert.equal(calls[0].body.messages[1].content.filter((c) => c.type === 'image_url').length, 2);
    calls.length = 0;
    chatReply = () => review('PRESENTER_YELLOW_1', { source: null });
    await validate('PRESENTER_YELLOW_1', {
      bangleSetType: 'IDENTICAL_PAIR',
      compositeSourceBuffer: BUF,
    });
    assert.equal(
      calls[0].body.response_format.json_schema.name,
      'generation_validation_bangle_pair_presenter',
      'presenters are never composites',
    );
  });

  test('distinct pair: a missing or cloned design fails; identical pairs are not checked for it', async () => {
    chatReply = () =>
      review('YELLOW_FRONT', { source: null, check: { eachReferenceDesignShownOnce: false } });
    const distinct = await validate('YELLOW_FRONT', { bangleSetType: 'DISTINCT_PAIR' });
    assert.ok(distinct.validationMessages.includes(`Failed: ${M.distinctDesigns}`));
    assert.match(
      calls[0].body.messages[1].content[0].text,
      /The two reference bangles have DIFFERENT designs: set eachReferenceDesignShownOnce/,
    );
    calls.length = 0;
    const identical = await validate('YELLOW_FRONT', { bangleSetType: 'IDENTICAL_PAIR' });
    assert.ok(!identical.validationMessages.includes(`Failed: ${M.distinctDesigns}`));
  });

  test('presenter images: one bangle on each wrist passes; both on one wrist fails', async () => {
    chatReply = () =>
      review('PRESENTER_YELLOW_2', {
        source: null,
        check: { visibleWristCount: 2, banglesPerVisibleWrist: [1, 1] },
      });
    assert.equal(
      (await validate('PRESENTER_YELLOW_2', { bangleSetType: 'IDENTICAL_PAIR' })).validationStatus,
      'passed',
    );
    chatReply = () =>
      review('PRESENTER_YELLOW_2', {
        source: null,
        check: {
          visibleWristCount: 2,
          banglesPerVisibleWrist: [2, 0],
          leftWristBangleCount: 2,
          rightWristBangleCount: 0,
        },
      });
    const same = await validate('PRESENTER_YELLOW_2', { bangleSetType: 'IDENTICAL_PAIR' });
    assert.ok(
      same.validationMessages.includes('Failed: Both bangles were placed on the same wrist.'),
    );
  });
});

// --- end to end through the job (DB + stubbed OpenAI + temp storage) -------
describe('job: identical-pair catalogue generation', () => {
  const created = [];
  const originalSend = boss.send;
  let productId;
  let presenterId;
  let referenceUrl;

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
       VALUES ('Composite Test Presenter', 'Test', 'http://x/p.jpg', 'http://x/f.jpg', 'http://x/45.jpg', 'http://x/s.jpg', 'http://x/j.jpg', ARRAY['BANGLE'])
       RETURNING id`,
    );
    presenterId = presenter.rows[0].id;
    const saved = await storageProvider.save(
      'products/ai-studio/composite-test/reference.png',
      await png(ringSvg(SINGLE[1])),
    );
    referenceUrl = saved.url;
  });

  after(async () => {
    boss.send = originalSend;
    if (created.length) await query('DELETE FROM ai_studio_jobs WHERE id = ANY($1)', [created]);
    if (presenterId) await query('DELETE FROM presenters WHERE id = $1', [presenterId]);
    fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  });

  async function confirmedJob(analysis) {
    const job = await insertJob({ productId, referenceImageUrls: [referenceUrl] });
    created.push(job.id);
    await query(
      "UPDATE ai_studio_jobs SET status = 'awaiting_confirmation', analysis = $2 WHERE id = $1",
      [job.id, JSON.stringify({ jewelleryType: 'BANGLE', ...analysis })],
    );
    const res = await new Promise((resolve) => {
      const r = {
        statusCode: 200,
        status(c) {
          this.statusCode = c;
          return this;
        },
        json(b) {
          resolve({ status: this.statusCode, body: b });
        },
      };
      confirmJob(
        {
          params: { id: productId, jobId: job.id },
          body: { jewelleryType: 'BANGLE', customerCategory: 'WOMEN', presenterId },
        },
        r,
        (err) => resolve({ status: 500, error: err }),
      );
    });
    assert.equal(res.status, 202, res.error?.message);
    return job;
  }
  const catalogueAssets = async (jobId) =>
    (await findAssetsByJobId(jobId)).filter((a) => !a.asset_type.startsWith('PRESENTER_'));
  const close = (jobId) =>
    query("UPDATE ai_studio_jobs SET status = 'cancelled' WHERE id = $1", [jobId]);

  test('identical pair: each catalogue image = one image call + one validation call; saved image has exactly two bangles; source kept', async () => {
    const job = await confirmedJob({ wristPieceCount: 2, bangleSetType: 'IDENTICAL_PAIR' });
    try {
      const targets = await catalogueAssets(job.id);
      for (const a of targets)
        assert.match(a.assembled_final_prompt, /Generate exactly ONE of them/);
      chatReply = (body) => review(assetTypeFrom(body));
      for (const asset of targets) {
        calls.length = 0;
        imageReply = await png(ringSvg(SINGLE[svc.bangleCatalogueShotFor(asset.asset_type)]));
        await generateHandler([{ data: { jobId: job.id, assetIds: [asset.id] } }]);
        assert.deepEqual(
          calls.map((c) => c.kind),
          ['image', 'chat'],
          `${asset.asset_type}: no additional OpenAI request`,
        );
        assert.equal(
          calls[1].body.messages[1].content.filter((c) => c.type === 'image_url').length,
          3,
        );
        const saved = (await findAssetsByJobId(job.id)).find((a) => a.id === asset.id);
        assert.equal(saved.status, 'READY', saved.error);
        assert.equal(
          saved.validation_status,
          'passed',
          JSON.stringify(saved.validation_result?.validationMessages),
        );
        const stored = await storageProvider.read(saved.image_key);
        assert.equal(
          (await objectsIn(stored)).length,
          2,
          `${asset.asset_type}: final catalogue image has exactly two bangles`,
        );
        const meta =
          typeof saved.generation_metadata === 'string'
            ? JSON.parse(saved.generation_metadata)
            : saved.generation_metadata;
        assert.equal(meta.composite.copies, 2);
        assert.equal(
          (await objectsIn(await storageProvider.read(meta.composite.sourceImageKey))).length,
          1,
          'source kept: one bangle',
        );
      }
    } finally {
      await close(job.id);
    }
  });

  test('a doubled source is rejected before compositing: asset FAILED with a clear reason, nothing saved, no validation call', async () => {
    const job = await confirmedJob({ wristPieceCount: 2, bangleSetType: 'IDENTICAL_PAIR' });
    try {
      const asset = (await catalogueAssets(job.id)).find(
        (a) => svc.bangleCatalogueShotFor(a.asset_type) === 2,
      );
      imageReply = await png(ringSvg(DOUBLED_WITH_GAP));
      calls.length = 0;
      await generateHandler([{ data: { jobId: job.id, assetIds: [asset.id] } }]);
      assert.deepEqual(
        calls.map((c) => c.kind),
        ['image'],
      );
      const saved = (await findAssetsByJobId(job.id)).find((a) => a.id === asset.id);
      assert.equal(saved.status, 'FAILED');
      assert.match(
        saved.error,
        /Composite not created: the generated source image contains 2 separate bangle-sized objects/,
      );
      assert.equal(saved.image_key, null);
    } finally {
      await close(job.id);
    }
  });

  test('older two-bangle jobs (no set type) and distinct pairs keep the existing flow: no composite', async () => {
    for (const analysis of [
      { wristPieceCount: 2 },
      { wristPieceCount: 2, bangleSetType: 'DISTINCT_PAIR' },
    ]) {
      const job = await confirmedJob(analysis);
      try {
        const asset = (await catalogueAssets(job.id)).find(
          (a) => svc.bangleCatalogueShotFor(a.asset_type) === 1,
        );
        assert.match(
          asset.assembled_final_prompt,
          /this image must contain exactly two physical bangles/,
        );
        const twoRings = await png(
          ringSvg([
            { cx: 512, cy: 300, rx: 420, ry: 80 },
            { cx: 512, cy: 700, rx: 420, ry: 80 },
          ]),
        );
        imageReply = twoRings;
        chatReply = (body) => review(assetTypeFrom(body), { source: null });
        calls.length = 0;
        await generateHandler([{ data: { jobId: job.id, assetIds: [asset.id] } }]);
        assert.deepEqual(
          calls.map((c) => c.kind),
          ['image', 'chat'],
        );
        assert.equal(
          calls[1].body.messages[1].content.filter((c) => c.type === 'image_url').length,
          2,
          'no source image',
        );
        const saved = (await findAssetsByJobId(job.id)).find((a) => a.id === asset.id);
        assert.equal(saved.status, 'READY', saved.error);
        const meta =
          typeof saved.generation_metadata === 'string'
            ? JSON.parse(saved.generation_metadata)
            : saved.generation_metadata;
        assert.equal(meta.composite, undefined);
        assert.deepEqual(
          await rawOf(await storageProvider.read(saved.image_key)),
          await rawOf(twoRings),
          'image saved exactly as generated',
        );
      } finally {
        await close(job.id);
      }
    }
  });
});
