// Pendant Product Size Image: the AI reviewer's flags are checked against
// the local pixel measurements (decidePendantResult). Production cases this
// covers (13 Nov 2026): Ivory Kite and Berry Dot failed with "Background is
// not clean enough…" although the local cleanup had measured a clean white
// border (borderShare 1). OpenAI is replaced by a fetch stub — nothing here
// makes a network or paid call. The end-to-end test uses the throwaway test
// DB and a temporary upload folder.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

process.env.OPENAI_API_KEY = 'sk-test';
process.env.OPENAI_VISION_MODEL = 'vision-test';
process.env.OPENAI_IMAGE_MODEL = 'image-test';
const UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ninekaret-pendant-size-'));
process.env.UPLOAD_DIR = UPLOAD_DIR;
process.env.UPLOADS_PUBLIC_BASE_URL = 'http://localhost:6002/uploads';

const svc = await import('../../src/services/productSizeImageService.js');
const { query } = await import('../../src/config/db.js');
const { insertJob } = await import('../../src/repositories/aiStudio.repository.js');
const { storageProvider } = await import('../../src/providers/storage/index.js');

const { decidePendantResult, PENDANT_REASONS, DETECTION_REASONS } = svc;
const OK_BOX = { box: { left: 300, top: 150, width: 420, height: 700 }, reason: null };
const NO_FLAGS = { designMismatch: false, bailMissingOrChanged: false, chainOrSupportVisible: false, angledOrTilted: false, croppedOrTouchingEdge: false, backgroundNotClean: false };
const review = (status, reasons, flags = {}) => ({ status, reasons, pendantCheck: { ...NO_FLAGS, ...flags } });
const BG = 'Background is not clean enough to detect product boundaries reliably.';

// --- fetch stub ---------------------------------------------------------------
const calls = [];
let imageReply = null;
let chatReply = {};
globalThis.fetch = async (url, init) => {
  if (init?.body instanceof FormData) {
    calls.push({ kind: 'image' });
    return new Response(JSON.stringify({ data: [{ b64_json: imageReply.toString('base64') }] }), { headers: { 'content-type': 'application/json' } });
  }
  const body = JSON.parse(init.body);
  calls.push({ kind: 'chat', body });
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

describe('decidePendantResult — reviewer flags checked against local measurements', () => {
  test('Berry Dot case: "background not clean" alone, but the cleanup measured a clean border and detection found margins → passes', () => {
    const d = decidePendantResult({ validation: review('failed', [BG], { backgroundNotClean: true }), cleanupApplied: true, detection: OK_BOX });
    assert.deepEqual(d, { status: 'passed', reasons: [] });
  });

  test('Ivory Kite case: background + "angled or cropped" → warning (image kept for the admin), not a failure', () => {
    const d = decidePendantResult({
      validation: review('failed', [BG, PENDANT_REASONS.angledOrCropped], { backgroundNotClean: true, angledOrTilted: true, croppedOrTouchingEdge: true }),
      cleanupApplied: true,
      detection: OK_BOX,
    });
    assert.equal(d.status, 'warning');
    assert.deepEqual(d.reasons, [PENDANT_REASONS.mayBeAngled]);
  });

  test('"cropped" alone is settled by the measured margin', () => {
    const ok = decidePendantResult({ validation: review('failed', [PENDANT_REASONS.angledOrCropped], { croppedOrTouchingEdge: true }), cleanupApplied: true, detection: OK_BOX });
    assert.equal(ok.status, 'passed');
    const touching = decidePendantResult({
      validation: review('passed', []),
      cleanupApplied: true,
      detection: { box: null, reason: DETECTION_REASONS.touchesFrame },
    });
    assert.deepEqual(touching, { status: 'failed', reasons: [DETECTION_REASONS.touchesFrame] }, 'a real crop still fails, even if the reviewer passed it');
  });

  test('"background not clean" still fails when the local cleanup could not confirm a clean border', () => {
    const d = decidePendantResult({ validation: review('failed', [BG], { backgroundNotClean: true }), cleanupApplied: false, detection: OK_BOX });
    assert.deepEqual(d, { status: 'failed', reasons: [BG] });
  });

  test('chain, design mismatch and a missing bail still fail exactly as before', () => {
    for (const flag of ['chainOrSupportVisible', 'designMismatch', 'bailMissingOrChanged']) {
      const d = decidePendantResult({ validation: review('failed', [`reason ${flag}`], { [flag]: true }), cleanupApplied: true, detection: OK_BOX });
      assert.deepEqual(d, { status: 'failed', reasons: [`reason ${flag}`] }, flag);
    }
    const chain = decidePendantResult({ validation: review('failed', [PENDANT_REASONS.chainVisible, BG], { chainOrSupportVisible: true, backgroundNotClean: true }), cleanupApplied: true, detection: OK_BOX });
    assert.equal(chain.status, 'failed', 'a chain is never overruled, even with a clean background');
  });

  test('a failure the flags do not explain stays a failure; a reviewer warning stays a warning; a clean pass passes', () => {
    assert.equal(decidePendantResult({ validation: review('failed', ['Something else.']), cleanupApplied: true, detection: OK_BOX }).status, 'failed');
    assert.deepEqual(decidePendantResult({ validation: review('warning', ['Faint shadow.']), cleanupApplied: true, detection: OK_BOX }), { status: 'warning', reasons: ['Faint shadow.'] });
    assert.deepEqual(decidePendantResult({ validation: review('passed', []), cleanupApplied: true, detection: OK_BOX }), { status: 'passed', reasons: [] });
  });

  test('detection failure fails with its measured reason (as before)', () => {
    const d = decidePendantResult({ validation: review('passed', []), cleanupApplied: true, detection: { box: null, reason: DETECTION_REASONS.notUniform } });
    assert.deepEqual(d, { status: 'failed', reasons: [DETECTION_REASONS.notUniform] });
  });
});

describe('reviewer request', () => {
  const BUF = Buffer.from('x');
  test('Pendant: one request, Pendant schema with flags, told to ignore the reference\'s grey background and text labels', async () => {
    chatReply = review('passed', []);
    await svc.validateProductSizeBase({ generatedBuffer: BUF, referenceBuffer: BUF, referenceMimetype: 'image/jpeg', jewelleryType: 'PENDANT' });
    assert.equal(calls.length, 1);
    const { body } = calls[0];
    assert.equal(body.response_format.json_schema.name, 'product_size_validation_pendant');
    assert.deepEqual(Object.keys(body.response_format.json_schema.schema.properties.pendantCheck.properties), Object.keys(NO_FLAGS));
    const text = body.messages[1].content[0].text;
    assert.match(text, /That background and text belong to the reference photo only — never judge the GENERATED image's background, framing or cropping from them/);
    // The existing Pendant rule is kept word for word.
    assert.ok(text.includes(`Set status "failed" if any chain, necklace chain, wire, thread or hanging support is visible, with the reason "${PENDANT_REASONS.chainVisible}"`));
  });

  test('every other category: request text and schema exactly as before', async () => {
    for (const type of ['RING', 'EARRINGS', 'BRACELET', 'BANGLE', 'NECKLACE', 'CHAIN']) {
      calls.length = 0;
      chatReply = { status: 'passed', reasons: [] };
      await svc.validateProductSizeBase({ generatedBuffer: BUF, referenceBuffer: BUF, referenceMimetype: 'image/jpeg', jewelleryType: type });
      const { body } = calls[0];
      assert.equal(body.response_format.json_schema.name, 'product_size_validation', type);
      assert.equal(body.response_format.json_schema.schema.properties.pendantCheck, undefined, type);
      assert.equal(body.messages[1].content[0].text, 'Review this generated Product Size Image base photo against the reference.', type);
      assert.equal(svc.buildProductSizeValidationText(type), 'Review this generated Product Size Image base photo against the reference.');
    }
  });
});

// --- end to end through runProductSizeGeneration ----------------------------
describe('runProductSizeGeneration (Pendant)', () => {
  let productId;
  let jobId;
  // A simple gold pendant (bail + body) on a light grey-white backdrop.
  const pendantPng = (offsetX = 0) =>
    sharp(
      Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#f6f6f6"/>
        <rect x="${470 + offsetX}" y="200" width="84" height="120" rx="20" fill="#d4a43a"/>
        <circle cx="${512 + offsetX}" cy="560" r="230" fill="#d4a43a"/><circle cx="${512 + offsetX}" cy="560" r="90" fill="#f6f6f6"/></svg>`),
    )
      .png()
      .toBuffer();
  const MEASUREMENTS = {
    jewellery_type: 'PENDANT',
    unit: 'mm',
    measurements: { pendantBodyWidth: 7.27, pendantBodyHeight: 8, pendantOverallHeight: 10 },
    included_parts: [],
    excluded_parts: [],
  };

  before(async () => {
    const { rows } = await query(
      `SELECT p.id FROM products p WHERE NOT EXISTS (
         SELECT 1 FROM ai_studio_jobs j WHERE j.product_id = p.id AND j.status NOT IN ('completed', 'failed', 'cancelled')) LIMIT 1`,
    );
    productId = rows[0].id;
    const saved = await storageProvider.save('products/ai-studio/pendant-size-test/reference.png', await pendantPng());
    const job = await insertJob({ productId, referenceImageUrls: [saved.url] });
    jobId = job.id;
    await query("UPDATE ai_studio_jobs SET status = 'cancelled' WHERE id = $1", [jobId]);
  });

  after(async () => {
    if (jobId) await query('DELETE FROM ai_studio_jobs WHERE id = $1', [jobId]);
    fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  });

  test('Berry Dot case end to end: reviewer says "background not clean", local checks confirm clean → image created, one image + one review call', async () => {
    imageReply = await pendantPng();
    chatReply = review('failed', [BG], { backgroundNotClean: true });
    const r = await svc.runProductSizeGeneration(productId, MEASUREMENTS);
    assert.deepEqual(calls.map((c) => c.kind), ['image', 'chat'], 'no extra AI call');
    assert.notEqual(r.status, 'failed', r.failureReason);
    assert.ok(Buffer.isBuffer(r.buffer));
  });

  test('Ivory Kite case end to end: background + angled → finished image kept as a warning for review', async () => {
    imageReply = await pendantPng();
    chatReply = review('failed', [BG, PENDANT_REASONS.angledOrCropped], { backgroundNotClean: true, angledOrTilted: true, croppedOrTouchingEdge: true });
    const r = await svc.runProductSizeGeneration(productId, MEASUREMENTS);
    assert.equal(r.status, 'warning');
    assert.ok(Buffer.isBuffer(r.buffer));
    assert.match(r.warningReason, /may be angled or tilted/);
  });

  test('chain visible still fails; a pendant touching the frame edge still fails even if the reviewer passed it', async () => {
    imageReply = await pendantPng();
    chatReply = review('failed', [PENDANT_REASONS.chainVisible], { chainOrSupportVisible: true });
    const chain = await svc.runProductSizeGeneration(productId, MEASUREMENTS);
    assert.deepEqual({ status: chain.status, failureReason: chain.failureReason }, { status: 'failed', failureReason: PENDANT_REASONS.chainVisible });

    imageReply = await pendantPng(380); // pushed against the right edge
    chatReply = review('passed', []);
    const edge = await svc.runProductSizeGeneration(productId, MEASUREMENTS);
    assert.deepEqual({ status: edge.status, failureReason: edge.failureReason }, { status: 'failed', failureReason: DETECTION_REASONS.touchesFrame });
  });
});
