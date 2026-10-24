import OpenAI, {
  toFile,
  APIConnectionTimeoutError,
  RateLimitError,
  BadRequestError,
  AuthenticationError,
  PermissionDeniedError,
} from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Measured live: a simple background-cleanup edit takes ~140s, but a
// PRESENTER shot (compositing a model + the jewellery) took ~490s in
// testing — real variance is much wider than the enhancement feature's.
// Timeout needs real headroom, and maxRetries is kept low (1, not the
// enhancement service's 2) since a retry on a call this slow multiplies
// worst-case wall time fast — see aiStudioJob.js's queue expiry, which is
// sized against this same worst case.
const REQUEST_TIMEOUT_MS = 600_000;

let client = null;
function getClient() {
  if (!env.openaiApiKey) {
    throw new AppError(503, 'AI Image Studio is not configured');
  }
  if (!client) {
    client = new OpenAI({ apiKey: env.openaiApiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  }
  return client;
}

function mapOpenAiError(err) {
  console.error('AI Image Studio OpenAI call failed:', err?.status ?? '', err?.message ?? err);

  if (err instanceof RateLimitError) {
    return new AppError(429, 'AI Image Studio is busy right now — please try again in a moment.');
  }
  if (err instanceof APIConnectionTimeoutError) {
    return new AppError(504, 'The request timed out — please try again.');
  }
  if (err instanceof BadRequestError) {
    return new AppError(400, 'The uploaded image could not be processed — try a different photo.');
  }
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return new AppError(503, 'AI Image Studio is not configured correctly.');
  }
  return new AppError(502, 'AI Image Studio request failed — please try again.');
}

export const JEWELLERY_TYPES = [
  'RING',
  'BRACELET',
  'BANGLE',
  'NECKLACE',
  'EARRINGS',
  'PENDANT',
  'CHAIN',
  'ANKLET',
  'NOSE_PIN',
  'MANGALSUTRA',
  'BROOCH',
  'OTHER',
  'UNKNOWN',
];

// e.g. "NOSE_PIN" -> "Nose Pin" — used for the human-readable category name
// embedded in prompts and shown on the Review Prompts panel.
export function formatJewelleryType(type) {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Customer category — WHO the piece is designed for (Gents/Kids/Women/
// Unisex) — is a separate dimension from jewelleryType (WHAT the piece is).
// Drives presenter selection only; see GENTS_PRESENTER_DESCRIPTOR /
// KIDS_PRESENTER_DESCRIPTOR below. 'WOMEN' is the default and preserves
// every existing prompt byte-for-byte (see buildAssetPromptSections).
export const CUSTOMER_CATEGORIES = ['WOMEN', 'GENTS', 'KIDS', 'UNISEX'];
export const DEFAULT_CUSTOMER_CATEGORY = 'WOMEN';

export function formatCustomerCategory(category) {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

const AnalysisSchema = z.object({
  jewelleryType: z.enum(JEWELLERY_TYPES),
  jewelleryTypeConfidence: z.number().min(0).max(1),
  metalColor: z.enum(['YELLOW', 'ROSE', 'WHITE']).nullable(),
  metalColorConfidence: z.number().min(0).max(1),
  gemstone: z.string().nullable(),
  gemstoneConfidence: z.number().min(0).max(1),
  dominantShape: z.string().nullable(),
  shapeConfidence: z.number().min(0).max(1),
  suggestedCategorySlug: z.string().nullable(),
  customerCategory: z.enum(CUSTOMER_CATEGORIES),
  customerCategoryConfidence: z.number().min(0).max(1),
});

const ANALYSIS_SYSTEM_PROMPT = `You are a jewellery product analyst. Examine the uploaded photograph and identify the jewellery item's type, metal colour, gemstone, and dominant shape, each with a confidence score from 0 to 1. Use "UNKNOWN" for jewelleryType only if the item genuinely does not match any of the listed types or the photo is too unclear to tell. Also suggest which customer category the piece is designed for — WOMEN, GENTS, KIDS, or UNISEX — based on styling cues such as scale, motif and design language (e.g. a small, simple band suggests KIDS; a broad, plain band suggests GENTS), with its own confidence score from 0 to 1; default to WOMEN when the cues are ambiguous. This is a suggestion for a human reviewer, not a final decision — always report your best honest confidence, do not artificially inflate it.`;

// Vision + structured output — every field is a suggestion the admin must
// confirm or correct; nothing here is ever written to the product directly
// (plan §5: "AI-detected attributes are suggestions only").
export async function analyseJewellery(imageBuffer, mimetype) {
  if (!env.openaiVisionModel) {
    throw new AppError(503, 'AI analysis is not configured');
  }
  const openai = getClient();
  const base64 = imageBuffer.toString('base64');

  try {
    const completion = await openai.chat.completions.parse({
      model: env.openaiVisionModel,
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyse this jewellery photo.' },
            { type: 'image_url', image_url: { url: `data:${mimetype};base64,${base64}`, detail: 'high' } },
          ],
        },
      ],
      response_format: zodResponseFormat(AnalysisSchema, 'jewellery_analysis'),
    });
    return completion.choices[0].message.parsed;
  } catch (err) {
    throw mapOpenAiError(err);
  }
}

const FIDELITY_BLOCK = `The uploaded jewellery reference is the definitive product. Preserve its exact jewellery type, stone count and apparent arrangement, stone shape and position, prongs and setting, metal colour, band or chain proportions, clasps, and every other distinctive construction detail. Do not redesign, reinterpret or add/remove/resize/reposition any component. Photorealistic, premium e-commerce jewellery photography. No text, logos, or watermarks.`;

// Necklace, Bracelet and Anklet never show their fastening (9karet, fixed
// rule — no per-product setting). The clasp stays part of the structure but
// is turned behind the piece or out of frame. Chain, Mangalsutra, Bangle and
// every other category keep their clasps as shown.
const HIDDEN_FASTENING_TYPES = new Set(['NECKLACE', 'BRACELET', 'ANKLET']);

export function hidesFastening(confirmedType) {
  return HIDDEN_FASTENING_TYPES.has(confirmedType);
}

// The general fidelity rule asks for clasps to be preserved; for the hidden-
// fastening categories that would contradict the rule below, so the clasp
// is preserved structurally but not shown.
const FIDELITY_BLOCK_HIDDEN_FASTENING = FIDELITY_BLOCK.replace(
  'band or chain proportions, clasps, and every other',
  'band or chain proportions, the fastening as part of the structure (kept out of sight — see the hidden-fastening rule), and every other',
);

function fidelityBlockFor(confirmedType) {
  return hidesFastening(confirmedType) ? FIDELITY_BLOCK_HIDDEN_FASTENING : FIDELITY_BLOCK;
}

const HIDDEN_FASTENING_NOTE =
  'Hidden fastening: do not show any clasp, hook, lock, lobster clasp, spring-ring clasp, S-hook, extension-chain end or fastening mechanism in the final generated image, even when it is visible in the uploaded reference. Do not delete or redesign the jewellery structure — do not cut the chain, close a gap with invented links, shorten it or add a substitute connector. Compose or rotate the jewellery so the fastening mechanism is naturally hidden behind the product or positioned outside the visible frame, with the piece still looking naturally closed and continuous. Preserve the exact chain design, jewellery shape, diamond count, stones, proportions and metal colour.';

// The 7-value asset vocabulary replaces the old 4-value shot_type — metal
// color is now encoded directly in the identifier (e.g. ROSE_FRONT) instead
// of being a separate per-job field, since a single job can now produce both
// Yellow and Rose Gold shots side by side.
export const ASSET_TYPES = [
  'YELLOW_FRONT',
  'YELLOW_HERO_45',
  'ROSE_FRONT',
  'ROSE_HERO_45',
  'PRESENTER_YELLOW_1',
  'PRESENTER_YELLOW_2',
  'PRESENTER_ROSE',
  // 9karet six-image jobs: the extra yellow catalogue views (Rose Gold OFF).
  'YELLOW_SIDE',
  'YELLOW_MACRO',
  // Reference-safe fallbacks when no 45° / side reference was uploaded.
  'YELLOW_SLIGHT_ANGLE',
  'ROSE_SLIGHT_ANGLE',
  'YELLOW_ELEVATED_DETAIL',
];

// Ring-only output structure — 2 hand-model shots + 4 catalogue shots
// (Front + Three-Quarter Side View, no 45° Hero), replacing the generic 7-value
// vocabulary above whenever confirmedType === 'RING'. See RING_ASSET_TYPE_SET
// and resolveAssetTypesForJob below for where the branch happens.
export const RING_ASSET_TYPES = [
  'RING_HAND_1',
  'RING_HAND_2',
  'RING_GOLD_FRONT',
  'RING_GOLD_SIDE',
  'RING_ROSE_FRONT',
  'RING_ROSE_SIDE',
  // 9karet six-image jobs (see buildOutputManifest).
  'RING_GOLD_HERO',
  'RING_GOLD_PROFILE',
  'RING_GOLD_MACRO',
  'RING_ROSE_HERO',
  'RING_HAND_ROSE',
  'RING_GOLD_SLIGHT_ANGLE',
  'RING_ROSE_SLIGHT_ANGLE',
  'RING_GOLD_ELEVATED_DETAIL',
];
const RING_ASSET_TYPE_SET = new Set(RING_ASSET_TYPES);

// ---------------------------------------------------------------------------
// Reference roles (9karet). New jobs store up to three references, each with
// its role in the object key: …/references/<uuid>-main_front.jpeg,
// -angle_45.jpeg, -side_profile.jpeg. The main/front reference is always
// first in reference_image_urls, so analysis and validation (which read the
// first image) are unchanged. Older jobs have no role in their keys: their
// first image is the main/front reference and the rest are supporting.
// ---------------------------------------------------------------------------
export const REFERENCE_ROLES = ['main_front', 'angle_45', 'side_profile'];
const ROLE_IN_KEY = /-(main_front|angle_45|side_profile)\.[a-z]+$/;

export function referenceRolesFor(referenceImageUrls) {
  const urls = referenceImageUrls ?? [];
  const tagged = urls.map((url) => ({ url, role: ROLE_IN_KEY.exec(url)?.[1] ?? null }));
  if (tagged.some((t) => t.role)) {
    const byRole = Object.fromEntries(tagged.filter((t) => t.role).map((t) => [t.role, t.url]));
    return { main_front: byRole.main_front ?? urls[0] ?? null, angle_45: byRole.angle_45 ?? null, side_profile: byRole.side_profile ?? null, roleTagged: true };
  }
  return { main_front: urls[0] ?? null, angle_45: null, side_profile: null, roleTagged: false };
}

// Which optional references a new job has — drives the catalogue views.
export function referenceAvailability(referenceImageUrls) {
  const roles = referenceRolesFor(referenceImageUrls);
  return { angle45: !!roles.angle_45, side: !!roles.side_profile };
}

// Mirrors the DB CHECK constraint in the ai_studio_presenters migration —
// must stay in lockstep with it, this is the single source of truth on the
// JS side.
export const ASSET_DISPLAY_ORDER = {
  YELLOW_FRONT: 0,
  YELLOW_HERO_45: 1,
  ROSE_FRONT: 2,
  ROSE_HERO_45: 3,
  PRESENTER_YELLOW_1: 4,
  PRESENTER_YELLOW_2: 5,
  PRESENTER_ROSE: 6,
  RING_HAND_1: 0,
  RING_HAND_2: 1,
  RING_GOLD_FRONT: 2,
  RING_GOLD_SIDE: 3,
  RING_ROSE_FRONT: 4,
  RING_ROSE_SIDE: 5,
};

// Which asset types get generated for a job. Ring is a completely separate,
// fixed output structure (Problem: the generic Yellow/Rose/Presenter shape
// doesn't apply to Rings at all) — 4 images normally, 6 when Rose Gold is
// required, in the exact Hand1/Hand2/Front/Side(/RoseFront/RoseSide) order.
// Every other jewellery type keeps the original logic untouched: Yellow Gold
// catalogue shots are always present, Rose Gold and presenter shots are
// additive, driven purely by the Rose Gold toggle and whether a presenter
// was picked. When both rose gold and a presenter are on, PRESENTER_YELLOW_1
// + PRESENTER_ROSE form a matched pose pair (same pose, two metals);
// PRESENTER_YELLOW_2 (a second, different-angle yellow view) is reserved for
// the no-rose-gold+presenter case, where there's no rose shot to pair
// against instead.
// Necklace always produces the full Yellow + Rose set — 2 catalogue shots
// per metal, plus one presenter shot per metal when a presenter is chosen —
// regardless of the admin's Rose Gold toggle (client requirement). Every
// other type follows the toggle.
//
// 9karet: superseded by the six-slot output manifest below — every new job
// produces exactly 4 catalogue + 2 presenter images, and the admin's
// "Generate Rose Gold" switch (default OFF, saved on the job) alone decides
// the metal split. Necklace is no longer forced to rose gold. Jobs created
// before this (output_manifest IS NULL) keep the assets they were given.
export function effectiveGenerateRoseGold(_confirmedType, requested) {
  return requested === true;
}

// ---------------------------------------------------------------------------
// Six-slot job planning (9karet). Four separate decisions, kept apart:
//   buildOutputManifest(generateRoseGold)    → how many images, which kind, which metal
//   resolveCatalogueViews(jewelleryCategory) → which catalogue angles
//   resolvePresenter(customerCategory, …)    → whose identity the presenter images use
//   buildGenerationRequest(…)                → the images + prompt sent for one slot
// buildJobPlan combines them into the manifest stored on the job.
// ---------------------------------------------------------------------------

export const MANIFEST_SIZE = 6;

// Metal distribution only — the same for every jewellery and customer
// category. `position` is the catalogue view (1-4) or presenter pose (1-2) a
// slot uses; rose slots reuse the yellow positions so both metals can be
// compared on the same view and pose.
export function buildOutputManifest(generateRoseGold) {
  const slots = generateRoseGold
    ? [
        ['yellow_catalogue_1', 'catalogue', 'YELLOW', 1],
        ['yellow_catalogue_2', 'catalogue', 'YELLOW', 2],
        ['rose_catalogue_1', 'catalogue', 'ROSE', 1],
        ['rose_catalogue_2', 'catalogue', 'ROSE', 2],
        ['yellow_presenter_1', 'presenter', 'YELLOW', 1],
        ['rose_presenter_1', 'presenter', 'ROSE', 1],
      ]
    : [
        ['yellow_catalogue_1', 'catalogue', 'YELLOW', 1],
        ['yellow_catalogue_2', 'catalogue', 'YELLOW', 2],
        ['yellow_catalogue_3', 'catalogue', 'YELLOW', 3],
        ['yellow_catalogue_4', 'catalogue', 'YELLOW', 4],
        ['yellow_presenter_1', 'presenter', 'YELLOW', 1],
        ['yellow_presenter_2', 'presenter', 'YELLOW', 2],
      ];
  return slots.map(([slotKey, kind, metal, position], index) => ({ slotKey, index, kind, metal, position }));
}

// Catalogue angles per jewellery category, in priority order — Rose Gold ON
// uses the first two. Ring: hero, front/top, side profile, macro. Every other
// category keeps its existing Front and 45° Hero views and adds a side
// profile and a macro view.
const CATALOGUE_VIEWS = {
  RING: [
    { view: 'HERO', YELLOW: 'RING_GOLD_HERO', ROSE: 'RING_ROSE_HERO' },
    { view: 'FRONT_TOP', YELLOW: 'RING_GOLD_FRONT', ROSE: 'RING_ROSE_FRONT' },
    { view: 'SIDE_PROFILE', YELLOW: 'RING_GOLD_PROFILE' },
    { view: 'MACRO', YELLOW: 'RING_GOLD_MACRO' },
  ],
  STANDARD: [
    { view: 'FRONT', YELLOW: 'YELLOW_FRONT', ROSE: 'ROSE_FRONT' },
    { view: 'HERO_45', YELLOW: 'YELLOW_HERO_45', ROSE: 'ROSE_HERO_45' },
    { view: 'SIDE_PROFILE', YELLOW: 'YELLOW_SIDE' },
    { view: 'MACRO', YELLOW: 'YELLOW_MACRO' },
  ],
};

// Reference-aware views (new jobs). Without a 45° reference the angled view
// becomes a safe 15–25° turn of the main reference; without a side reference
// the side view becomes a reference-faithful elevated detail view — a strict
// side profile is only requested when a side reference exists. Each view
// names the reference that drives its geometry; the main/front reference is
// always attached as well, for product identity.
const SAFE_VIEWS = {
  STANDARD: {
    SLIGHT_ANGLE: { view: 'SLIGHT_ANGLE', YELLOW: 'YELLOW_SLIGHT_ANGLE', ROSE: 'ROSE_SLIGHT_ANGLE' },
    ELEVATED_DETAIL: { view: 'ELEVATED_DETAIL', YELLOW: 'YELLOW_ELEVATED_DETAIL' },
  },
  RING: {
    SLIGHT_ANGLE: { view: 'SLIGHT_ANGLE', YELLOW: 'RING_GOLD_SLIGHT_ANGLE', ROSE: 'RING_ROSE_SLIGHT_ANGLE' },
    ELEVATED_DETAIL: { view: 'ELEVATED_DETAIL', YELLOW: 'RING_GOLD_ELEVATED_DETAIL' },
  },
};

// `references` = { angle45, side } for new jobs; omitted (older callers)
// means the full original view set.
export function resolveCatalogueViews(jewelleryCategory, generateRoseGold, references) {
  const kind = jewelleryCategory === 'RING' ? 'RING' : 'STANDARD';
  const [first, second, side, macro] = CATALOGUE_VIEWS[kind];
  let views;
  if (!references) {
    views = [first, second, side, macro].map((v) => ({ ...v, geometry: 'main_front' }));
  } else {
    const angleView = references.angle45
      ? { ...(kind === 'RING' ? first : second), geometry: 'angle_45' }
      : { ...SAFE_VIEWS[kind].SLIGHT_ANGLE, geometry: 'main_front' };
    const frontView = { ...(kind === 'RING' ? second : first), geometry: 'main_front' };
    const sideView = references.side
      ? { ...side, geometry: 'side_profile' }
      : {
          ...SAFE_VIEWS[kind].ELEVATED_DETAIL,
          geometry: 'main_front',
          supporting: references.angle45 ? ['angle_45'] : [],
        };
    const macroView = { ...macro, geometry: 'main_front' };
    // Ring keeps its hero/angled view first (its primary image); every other
    // category keeps the front view first.
    views = kind === 'RING' ? [angleView, frontView, sideView, macroView] : [frontView, angleView, sideView, macroView];
  }
  return generateRoseGold ? views.slice(0, 2) : views;
}

// How a presenter image is shown — also a jewellery-category decision: Ring
// is a hand-wearing shot (no face required), everything else is worn by a
// presenter. Pose 2 of yellow is a second pose; the rose shot repeats pose 1.
const PRESENTER_SHOTS = {
  RING: { YELLOW: ['RING_HAND_1', 'RING_HAND_2'], ROSE: ['RING_HAND_ROSE'] },
  STANDARD: { YELLOW: ['PRESENTER_YELLOW_1', 'PRESENTER_YELLOW_2'], ROSE: ['PRESENTER_ROSE'] },
};

// Where a presenter identity comes from.
export const IDENTITY_SOURCES = {
  // The chosen presenter's own reference photos, attached to both requests.
  PRESENTER_PHOTO: 'PRESENTER_PHOTO',
  // One AI-generated male identity portrait per job, attached to both.
  GENTS_MASTER: 'GENTS_MASTER',
  // No saved reference: the first presenter image is generated, then used
  // as the identity reference for the second (generated afterwards).
  FIRST_OUTPUT: 'FIRST_OUTPUT',
};

// Presenter identity only — never changes counts, metals, views or order.
//   Ring (any customer category): a hand, chained from the first hand image.
//   Gents: the job's fixed male identity portrait.
//   Kids: the chosen child presenter's photo if one is picked, otherwise
//         chained from the first generated child image.
//   Women / Unisex: the chosen presenter's photos (required).
export function resolvePresenter({ customerCategory, selectedPresenter, jewelleryCategory, requirePresenter = true }) {
  const audience = customerCategory ?? DEFAULT_CUSTOMER_CATEGORY;
  if (jewelleryCategory === 'RING') {
    return { audience, subject: 'HAND', source: IDENTITY_SOURCES.FIRST_OUTPUT, presenterId: null };
  }
  if (audience === 'GENTS') {
    return { audience, subject: 'PERSON', source: IDENTITY_SOURCES.GENTS_MASTER, presenterId: null };
  }
  if (audience === 'KIDS') {
    return selectedPresenter
      ? { audience, subject: 'CHILD', source: IDENTITY_SOURCES.PRESENTER_PHOTO, presenterId: selectedPresenter.id }
      : { audience, subject: 'CHILD', source: IDENTITY_SOURCES.FIRST_OUTPUT, presenterId: null };
  }
  if (!selectedPresenter && requirePresenter) {
    throw new AppError(400, 'Choose a presenter — both presenter images use the selected presenter.');
  }
  return {
    audience,
    subject: 'PERSON',
    source: IDENTITY_SOURCES.PRESENTER_PHOTO,
    presenterId: selectedPresenter?.id ?? null,
  };
}

function assetTypesForSlots(manifest, jewelleryCategory, generateRoseGold, references) {
  const views = resolveCatalogueViews(jewelleryCategory, generateRoseGold, references);
  const shots = PRESENTER_SHOTS[jewelleryCategory === 'RING' ? 'RING' : 'STANDARD'];
  return manifest.map((slot) => {
    if (slot.kind === 'catalogue') {
      const view = views[slot.position - 1];
      const extra = references
        ? { references: { geometry: view?.geometry ?? 'main_front', supporting: view?.supporting ?? [] } }
        : {};
      return { view: view?.view, assetType: view?.[slot.metal], ...extra };
    }
    const list = shots[slot.metal];
    return { view: `POSE_${slot.position}`, assetType: slot.metal === 'ROSE' ? list[0] : list[slot.position - 1] };
  });
}

// The complete plan stored on the job: every slot with its asset type, view
// and presenter identity — built and validated before anything generates.
export function buildJobPlan({
  jewelleryCategory,
  generateRoseGold,
  customerCategory,
  selectedPresenter,
  requirePresenter = true,
  // { angle45, side } — which optional references the job has (new jobs).
  references,
}) {
  const manifest = buildOutputManifest(generateRoseGold);
  const types = assetTypesForSlots(manifest, jewelleryCategory, generateRoseGold, references);
  const presenter = resolvePresenter({ customerCategory, selectedPresenter, jewelleryCategory, requirePresenter });
  const firstPresenterSlot = manifest.find((m) => m.kind === 'presenter').slotKey;
  const plan = manifest.map((slot, i) => {
    const base = { ...slot, ...types[i] };
    if (slot.kind === 'catalogue') return base;
    const chained = presenter.source === IDENTITY_SOURCES.FIRST_OUTPUT && slot.slotKey !== firstPresenterSlot;
    return { ...base, identity: { ...presenter, referenceSlot: chained ? firstPresenterSlot : null } };
  });
  assertValidManifest(plan, { generateRoseGold });
  return plan;
}

export function assertValidManifest(manifest, { generateRoseGold }) {
  const fail = (why) => {
    throw new AppError(500, `Invalid image plan: ${why}`);
  };
  if (!Array.isArray(manifest) || manifest.length !== MANIFEST_SIZE) fail(`expected ${MANIFEST_SIZE} slots`);
  if (new Set(manifest.map((m) => m.slotKey)).size !== manifest.length) fail('slot keys must be unique');
  if (manifest.some((m) => !m.assetType)) fail('every slot needs an image type');
  if (new Set(manifest.map((m) => m.assetType)).size !== manifest.length) fail('image types must be unique');
  const count = (pred) => manifest.filter(pred).length;
  if (count((m) => m.kind === 'catalogue') !== 4) fail('expected 4 catalogue slots');
  if (count((m) => m.kind === 'presenter') !== 2) fail('expected 2 presenter slots');
  const rose = count((m) => m.metal === 'ROSE');
  if (generateRoseGold ? rose !== 3 : rose !== 0) fail(generateRoseGold ? 'expected 3 rose-gold slots' : 'rose-gold slot in a yellow-only plan');
  for (const m of manifest) {
    if (metalColorForAssetType(m.assetType, generateRoseGold) !== m.metal) fail(`${m.slotKey} has the wrong metal`);
  }
  // Both presenter images must resolve to one identity.
  const presenters = manifest.filter((m) => m.kind === 'presenter');
  if (presenters.some((m) => !m.identity)) fail('presenter slots need an identity');
  const [first, second] = presenters;
  const same = (k) => first.identity[k] === second.identity[k];
  if (!same('source') || !same('presenterId') || !same('audience') || !same('subject')) {
    fail('both presenter images must use the same presenter identity');
  }
  if (first.identity.referenceSlot) fail('the first presenter image cannot depend on another image');
  if (first.identity.source === IDENTITY_SOURCES.FIRST_OUTPUT && second.identity.referenceSlot !== first.slotKey) {
    fail('the second presenter image must use the first as its identity reference');
  }
}

// Asset types for a job, without a presenter decision (labels, counts).
export function resolveAssetTypesForJob({ generateRoseGold, confirmedType, references }) {
  return assetTypesForSlots(buildOutputManifest(generateRoseGold), confirmedType, generateRoseGold, references).map(
    (t) => t.assetType,
  );
}

// One generation request: the images to attach, in order, and the prompt.
//   chained / Gents slot → [identity reference, jewellery]
//   presenter-photo slot → [jewellery, presenter photo]
//   catalogue slot       → [jewellery]
// The original jewellery reference is always attached.
export function buildGenerationRequest({
  outputSlot,
  jewelleryReference,
  presenterReference,
  identityReference,
  viewReferences = [],
  prompt,
}) {
  if (!jewelleryReference?.buffer) throw new AppError(500, 'The jewellery reference is required');
  // Catalogue slots of new jobs: [main/front, view reference(s)] — the main
  // reference stays first as the product-identity source.
  if (outputSlot?.kind === 'catalogue' && viewReferences.length) {
    return {
      images: [
        { role: 'jewellery', ...jewelleryReference },
        ...viewReferences.map((v) => ({ role: v.role, filename: `${v.role}.jpeg`, mimetype: 'image/jpeg', buffer: v.buffer })),
      ],
      prompt,
    };
  }
  if (outputSlot?.identity?.referenceSlot && !identityReference) {
    throw new AppError(409, 'The first presenter image must be generated before this one');
  }
  const jewellery = { role: 'jewellery', ...jewelleryReference };
  let images;
  if (identityReference) {
    images = [{ role: 'identity', filename: 'presenter-identity.png', mimetype: 'image/png', ...identityReference }, jewellery];
  } else if (presenterReference) {
    images = [jewellery, { role: 'presenter', filename: 'presenter.jpeg', mimetype: 'image/jpeg', ...presenterReference }];
  } else {
    images = [jewellery];
  }
  return { images, prompt };
}

// RING_HAND_2's metal depends on the Rose Gold toggle (Rose when required,
// Gold otherwise — it's always "the second hand shot", not always Rose) —
// every other asset type is unambiguous from its name alone, so the extra
// param is a no-op for them.
export function metalColorForAssetType(assetType, generateRoseGold = true) {
  if (assetType === 'RING_HAND_2') return generateRoseGold ? 'ROSE' : 'YELLOW';
  if (assetType === 'RING_HAND_ROSE') return 'ROSE';
  if (assetType.startsWith('RING_ROSE_')) return 'ROSE';
  if (RING_ASSET_TYPE_SET.has(assetType)) return 'YELLOW';
  return assetType.startsWith('ROSE_') || assetType === 'PRESENTER_ROSE' ? 'ROSE' : 'YELLOW';
}

// Which of a presenter's 4 reference photos to use as the second input image
// for a given presenter asset type — PRESENTER_YELLOW_1/PRESENTER_ROSE share
// a pose (the matched comparison pair), PRESENTER_YELLOW_2 uses a different
// angle so it isn't a near-duplicate of PRESENTER_YELLOW_1 within the same job.
const PRESENTER_POSE_REFERENCE = {
  PRESENTER_YELLOW_1: 'front_portrait_url',
  PRESENTER_ROSE: 'front_portrait_url',
  PRESENTER_YELLOW_2: 'face_45_url',
};

// Catalogue shots — every category now shares the one white studio
// background system originally approved for Ring only (client correction:
// having a separate warm/cool-ivory system for every other category looked
// inconsistent next to Ring in the storefront). See
// RING_GOLD_CATALOGUE_BACKGROUND_NOTE / RING_ROSE_CATALOGUE_BACKGROUND_NOTE /
// RING_CATALOGUE_LIGHTING_NOTE further below — those three constants are now
// reused as-is for every category's FRONT and HERO_45 shots, keyed only by
// metal colour, never by category. Model/presenter/hand/lifestyle shots are
// unaffected — they keep their own natural photographic environments.
const CATALOGUE_SIZE_NOTE = 'Create a premium square jewellery catalogue photograph at 816 × 816px.';

// 45° Hero Angle — exact spec supplied by the client, replacing the generic
// per-category template.hero_45_prompt entirely for this one asset type
// (its own rotation/elevation/framing geometry and exclusion list —
// self-contained, not layered with CATALOGUE_SIZE_NOTE above, which would
// just contradict its numbers). Background/lighting are NOT embedded in this
// string — they're filled in per metal colour from the shared Ring notes at
// the call site, same as every other catalogue shot. FRONT and presenter
// prompts are untouched.
const HERO_45_PROMPT =
  'Create a premium square jewellery catalogue image at 816 × 816px using the uploaded jewellery as the exact product reference. ' +
  'Position the jewellery in a three-quarter hero view: rotate the product approximately 40 degrees horizontally from the straight front position, use approximately 15-20 degree camera elevation, keep the main decorative face directed toward the camera, and clearly show the front design, setting height, band thickness and one side profile. ' +
  'Do not rotate the product so far that the primary design becomes hidden. ' +
  'Centre the jewellery precisely, make the product occupy approximately 70-75% of the frame width, and minimise unnecessary empty background space. ' +
  'Add a subtle natural grounding shadow directly below the jewellery. Do not make the jewellery appear to float. ' +
  'Preserve the exact original jewellery design, metal colour, stone count, stone positions, stone shapes, prongs, settings, proportions and band structure. Do not add, remove, relocate or redesign any component. ' +
  'Do not include hands, presenters, props, packaging, text, flowers, fabric or decorative elements.';

// Presenter shots stay off pure white on purpose — a plain white backdrop
// behind a person reads as a passport photo, not premium jewellery
// presentation. Instead the backdrop colour is chosen to complement whatever
// the presenter reference photo actually shows (skin tone, hair, outfit),
// rather than being hardcoded per presenter (no such field exists on the
// presenters table, and a text instruction lets the model read it directly
// off the attached reference image).
const PRESENTER_BACKGROUND_NOTE =
  ' Use a soft, solid studio backdrop colour that elegantly complements the presenter shown in the attached reference photo — coordinated with their skin tone, hair colour, and styling — refined and premium, not a busy pattern and not pure white.';

// Category-specific presenter placement/exclusion rules (Problem 2: presenter
// shots must show only the uploaded product, no unrelated jewellery). The
// four categories the spec gave exact wording for use it verbatim; every
// other type — including the two new ones, Brooch/Other — gets a generic
// rule of the same shape rather than being left unsupported.
// Shared catalogue background (9karet) — every jewellery category's product
// shots (FRONT/HERO_45 and the Ring Front/Side views) sit on a seamless pure
// white studio background with a soft natural contact shadow, for both Gold
// and Rose Gold. Kept as two constants keyed by metal colour so the call
// sites stay unchanged. Model/presenter/hand/lifestyle shots are unaffected.
const WHITE_CATALOGUE_BACKGROUND_NOTE =
  ' Use a seamless, pure white (#FFFFFF) studio background — evenly lit, with no fabric, folds, texture, gradient, vignette or colour tint. Add only a soft, natural contact shadow directly beneath the jewellery so it sits grounded on the surface. Keep clear separation between the metal and the white background, and do not let the background tint the metal or the gemstones.';
const RING_GOLD_CATALOGUE_BACKGROUND_NOTE = WHITE_CATALOGUE_BACKGROUND_NOTE;
const RING_ROSE_CATALOGUE_BACKGROUND_NOTE = WHITE_CATALOGUE_BACKGROUND_NOTE;
const RING_CATALOGUE_LIGHTING_NOTE =
  ' Use soft, premium studio lighting with natural, controlled product shadows, keeping the jewellery clearly separated from the background. Avoid busy props, flowers, boxes, unrelated decorative objects or hard reflections. The background must remain secondary to the product.';
const RING_SIZE_NOTE = 'Create a premium square jewellery photograph at 816 × 816px.';

// Hand-pose background is a natural photographic environment picked to suit
// the pose, NOT a brand/metal-colour cue — client correction: "Background
// colour must not change according to the ring's metal colour," so this one
// note is shared by both RING_HAND_1 (Yellow Gold) and RING_HAND_2 (Rose
// Gold) rather than each metal getting its own tinted backdrop.
const RING_HAND_BACKGROUND_NOTE =
  ' Use a natural photographic environment appropriate to the hand pose — for example a neutral studio background, a white or light-grey background, a black studio background, a soft natural interior, or a subtle beige background. Do not force a champagne, ivory, peach or rose-coloured background onto this hand shot, and do not choose the background colour based on the ring\'s metal colour.';
const RING_HAND_LIGHTING_NOTE =
  ' Use soft, natural photographic lighting with the ring sharply focused and the complete ring design clearly visible.';

// The two Ring hand shots are now always these fixed lifestyle compositions —
// client correction: no admin pose choice, no "Choose a Hand Pose" screen;
// generation starts immediately once the category is confirmed. Unlike the
// old Hand Pose workflow, a face IS allowed to be visible here — only OTHER
// jewellery (earrings, necklace, etc.) is excluded, not the model's face.
const RING_HAND_PLACEMENT_COMPOSITION =
  "The ring must physically wrap around the ring finger: the decorative top sits above the finger and the rear band is hidden behind the finger, with the band's angle matching the direction of the finger. Render realistic scale, lighting and contact shadows so the ring reads as genuinely worn, not composited on top of the hand.";

const RING_HAND_PLACEMENT_NEGATIVES = [
  "Show exactly one ring, worn on the correct ring finger — preserve the uploaded ring's exact design and realistic size.",
  'Do not make the ring float above the skin.',
  'Do not paste the complete circular band flatly over the finger.',
  'Do not embed the ring inside the skin.',
  'Do not place the ring on the wrong finger.',
  'Do not add or remove any stones from the ring.',
];

const RING_HAND_NO_OTHER_JEWELLERY_NEGATIVE =
  'Do not show earrings, a necklace, or any other distracting jewellery on the model — only the uploaded ring should be visible.';

// Appended as an extra negative instruction on every Ring asset type, on top
// of the generic FIDELITY_BLOCK every asset type already gets — Ring's
// stricter fidelity list (no bangle/bracelet conversion, no mixing in
// elements from pose/background reference images) doesn't apply to any other
// category. Client correction raised this to "highest priority": pose and
// background reference images may only ever influence pose/angle/background,
// never the jewellery design itself, and a visually attractive but
// inaccurate result must never be treated as good enough.
const RING_FIDELITY_EXTRA =
  'The uploaded product image is the only source of truth for the ring design — preserve the exact number, shape and position of every stone, the centre-stone shape and setting, band count and structure, pavé arrangement, curves/crossings/gaps, proportions, setting height, metal thickness and every decorative detail. Do not invent additional stones, remove stones, create a second ring, change the centre stone, change the band design, simplify the construction, or mirror/symmetrise an asymmetric detail. Do not redesign the ring to suit the pose. Pose and background reference images may influence only the hand position, camera angle or background — never the jewellery design. A visually attractive but structurally inaccurate result is not acceptable — do not add, remove or move stones, change the motif or band design, add another band, invent a different setting, convert the ring into a bangle or bracelet, or mix the uploaded ring with any design elements from pose or background reference images.';

// Appended as an extra instruction on every asset type for a confirmed
// Necklace — a Necklace-category product is either a necklace alone or a
// necklace + matching earrings set photographed together in one reference
// image. Kept conditional on what the reference actually shows (not a
// separate type), and deliberately silent on position/background/framing so
// every existing Necklace composition stays exactly as it was.
// Two variants on purpose: mentioning a presenter in a catalogue shot's
// prompt was enough to make the model put a woman into a product-only
// image, so catalogue shots never see the presenter wording.
// Earrings in a set are small and easy for the image model to "upgrade" —
// it repeatedly turned compact clover studs into long drop earrings. Their
// type, size and length are pinned explicitly, in both shot kinds.
const SET_EARRING_FIDELITY =
  'Reproduce the matching earrings exactly as they appear in the uploaded reference — the same earring type, size, length, motif and stone layout. If they are stud earrings, render them as small studs sitting flat directly on the earlobe: never turn studs into drop, dangle, chandelier, jhumka or hoop earrings, never add hanging elements, chains, extra motifs or extra stones, and never lengthen or enlarge them. Keep the earrings in realistic proportion to the necklace motifs, as in the reference.';

const NECKLACE_SET_NOTE_CATALOGUE =
  `If the uploaded reference shows a necklace set — the necklace together with matching earrings — the earrings are part of this product: lay the necklace AND the matching earrings out together in this one product image, reproducing both exactly as in the reference. ${SET_EARRING_FIDELITY} Do not drop the earrings or the necklace from a set. If the reference shows only a necklace, do not add any earrings.`;
const NECKLACE_SET_NOTE_PRESENTER =
  `If the uploaded reference shows a necklace set — the necklace together with matching earrings — the earrings are part of this product: the presenter must wear both, the necklace on the neck and the matching earrings on both ears, clearly visible and not hidden by hair, reproducing both exactly as in the reference. ${SET_EARRING_FIDELITY} Do not drop the earrings or the necklace from a set. If the reference shows only a necklace, do not add any earrings.`;

// Every non-presenter catalogue shot (FRONT / HERO_45, any category) is
// product-only — stated explicitly because the front prompt previously
// only listed props, and the image model filled the gap with a model.
const CATALOGUE_NO_PERSON_NOTE =
  'This is a product-only catalogue image: do not include any person, model, mannequin, bust, face, neck, ears, hands or other body part — show only the jewellery on the backdrop.';
const CATALOGUE_ASSET_TYPES = new Set([
  'YELLOW_SLIGHT_ANGLE',
  'ROSE_SLIGHT_ANGLE',
  'YELLOW_ELEVATED_DETAIL',
  'RING_GOLD_SLIGHT_ANGLE',
  'RING_ROSE_SLIGHT_ANGLE',
  'RING_GOLD_ELEVATED_DETAIL',
  'YELLOW_FRONT',
  'YELLOW_HERO_45',
  'ROSE_FRONT',
  'ROSE_HERO_45',
  'YELLOW_SIDE',
  'YELLOW_MACRO',
  'RING_GOLD_HERO',
  'RING_GOLD_PROFILE',
  'RING_GOLD_MACRO',
  'RING_ROSE_HERO',
]);

// Rose-gold outputs (9karet): only the metal changes — the design, the
// stones and everything around the piece stay exactly as they are.
const ROSE_GOLD_CONVERSION_NOTE =
  'Rose gold: convert only the metal to a realistic, premium rose-gold tone. Keep diamonds and colourless stones colourless, keep coloured gemstones their exact colour, and do not change the design, the stones or the proportions. Do not make the whole image pink, and do not add a pink colour cast to the background, the skin or the clothing.';

// Catalogue prompts of new jobs (reference-role aware): a reproduction, not a
// design task. Sits next to the general fidelity rule without repeating it.
const PRODUCT_REPRODUCTION_NOTE =
  'This is a product-reproduction task, not a jewellery-design task. The uploaded main reference is the definitive product specification. Reproduce the same physical jewellery. Preserve the exact stone count, stone shapes, stone sizes, stone positions, prongs, settings, metal sections, chain or band pattern, openings, thickness and visible proportions. Do not create a similar product. Do not redesign, simplify, enhance, add, remove, resize, move or reshape any component. Use the relevant angled or side reference only to understand the product geometry for that specific view. If a structural detail is not visible in any uploaded reference, do not invent it. Keep the unseen structure outside the visible composition.';

const REFERENCE_ROLE_LABELS = {
  angle_45: 'the 45° angled reference of the same jewellery',
  side_profile: 'the side-profile reference of the same jewellery',
};

// Tells the model which attached image is which.
function referenceOrderNote(slotReferences) {
  if (!slotReferences) return '';
  const extras = [slotReferences.geometry, ...(slotReferences.supporting ?? [])].filter((r) => r && r !== 'main_front');
  if (!extras.length) return 'The attached image is the main/front reference — the definitive product.';
  const parts = extras.map((r, i) => `attached image ${i + 2} is ${REFERENCE_ROLE_LABELS[r]}`);
  return `Attached image 1 is the main/front reference — the definitive product. ${parts.join('; ')} — use it only to understand the geometry for this view.`;
}

const SLIGHT_ANGLE_COMPOSITION =
  'Reference-matched alternate view. Show the exact uploaded jewellery with the camera moved only slightly — the piece rotated approximately 15–25 degrees from the main reference, the visible design still facing the camera. Do not create a complete side profile or reveal an invented reverse construction. Keep the complete piece inside the frame.';
const ELEVATED_DETAIL_COMPOSITION =
  'Create a reference-faithful elevated detail view of the exact uploaded jewellery. Keep the visible design facing the camera and rotate it only slightly, approximately 15–25 degrees. Do not create a complete side profile or reveal an invented reverse construction. If a structural detail is not clearly visible in the uploaded reference, do not invent it. Keep that area outside the visible composition. The result must look like the same physical jewellery photographed with a slightly adjusted camera position, not a newly designed similar product.';

// Extra catalogue views for six-image jobs. Non-Ring categories keep their
// existing Front and 45° Hero views and add these two; Ring adds a hero, a
// true side profile and a macro view alongside its existing front view.
function extraCatalogueView(assetType, categoryLabel) {
  const piece = categoryLabel ? categoryLabel.toLowerCase() : 'jewellery piece';
  switch (assetType) {
    case 'YELLOW_SIDE':
      return {
        composition: `Side-profile view. Show the ${piece} from the side, so its thickness, depth, setting height and construction (for example an earring post or hook, a pendant bail, or the profile of a band or link) are clearly shown. The angle must give genuine side-profile information, clearly different from the front and 45-degree views. Keep the complete piece inside the frame.`,
        negatives: [
          'Do not crop any part of the jewellery out of frame.',
          'Do not reuse or slightly rotate the 45-degree hero view — this must be a true side profile.',
          'Do not show the piece face-on from the front.',
        ],
      };
    case 'YELLOW_MACRO':
      return {
        composition: `Macro detail view. A close-up of the main design of the ${piece}: the main stone or motif, the setting, the small stones, the metal finishing and the craftsmanship details, sharp and clearly lit. Keep the main design as the focal point. Part of the piece (for example a chain or band) may extend outside the frame.`,
        negatives: [
          'Do not crop any important stone or primary design detail out of frame — only a chain, band or similar may be cut off.',
          'Do not invent texture, engraving or stones that are not visible on the reference.',
        ],
      };
    case 'RING_GOLD_HERO':
    case 'RING_ROSE_HERO':
      return {
        composition:
          'Hero three-quarter view — the primary product image. Stand the complete ring upright on its band and turn it to an approximately 40-45 degree three-quarter angle, so the centre stone, the decorative top and the band are all clearly visible. Centre the ring with balanced white space around it and keep the complete ring inside the frame.',
        negatives: ['Do not crop any part of the ring out of frame.', 'Do not use a flat top-down view or a pure side profile for this shot.'],
      };
    case 'RING_GOLD_PROFILE':
      return {
        composition:
          'Side-profile view. Stand the ring upright and photograph it from the side, so the band profile, the setting height, the prongs and the centre-stone mounting are clearly shown. Preserve the original band thickness and structural proportions. The angle must give genuine side-profile information. Keep the complete ring inside the frame.',
        negatives: [
          'Do not crop any part of the ring out of frame.',
          'Do not reuse or slightly rotate the hero three-quarter view — this must be a true side profile.',
          'Do not show the ring face-on from the front.',
        ],
      };
    default:
      return {
        composition:
          'Macro detail view. A close-up of the main design: the centre stone, the prongs, the small stones, the metal finishing and the setting details, sharp and clearly lit. Keep the centre design as the focal point. Part of the band may extend outside the frame.',
        negatives: [
          'Do not crop any important stone or primary design detail out of frame — only the band may be cut off.',
          'Do not invent texture, engraving or stones that are not visible on the reference.',
        ],
      };
  }
}

// The second presenter image of a chained job (Kids without a saved child
// reference, and every Ring hand pair): the first generated image is
// attached first, as the identity reference.
const CHAINED_CHILD_IDENTITY_NOTE =
  "The first attached image is the first presenter image from this same set — reproduce exactly the same child: the same face, apparent age, skin tone, hairstyle, clothing and body proportions, so it is recognisably the same child. The second attached image is the exact jewellery product — it controls only the jewellery design, never the child's appearance.";
const CHAINED_HAND_IDENTITY_NOTE =
  "The first attached image is the first hand image from this same set — reproduce exactly the same hand: the same skin tone, finger proportions, nail length, nail shape and nail colour, the same lighting and the same background style. The second attached image is the exact ring product — it controls only the ring design, never the hand's appearance.";
const CHAINED_SAME_POSE_NOTE =
  'Keep the same pose, crop, lighting and composition as the first image so the two can be compared — change only the jewellery metal colour.';
const CHAINED_NEW_POSE_NOTE = 'Use a different, suitable pose or crop from the first image, keeping the same identity.';

function chainedIdentityNote(identity, metal) {
  if (!identity?.referenceSlot) return '';
  const who = identity.subject === 'HAND' ? CHAINED_HAND_IDENTITY_NOTE : CHAINED_CHILD_IDENTITY_NOTE;
  return ` ${who} ${metal === 'ROSE' ? CHAINED_SAME_POSE_NOTE : CHAINED_NEW_POSE_NOTE}`;
}

// Both presenter images of one job show the same person (9karet).
const PRESENTER_SAME_IDENTITY_NOTE =
  'Both presenter images in this set show the same person — the same face, skin tone, apparent age, hairstyle, body proportions, photography style, background and lighting. Do not generate a different person.';
const RING_HAND_SAME_IDENTITY_NOTE =
  "Both hand images in this set show the same model's hand — the same skin tone, hand shape, nail style, photography style and lighting. Do not generate a different person.";

// Audience-specific presenter description (Gents/Kids), substituted for
// whichever real presenter's own prompt_descriptor would otherwise be used
// (non-Ring PRESENTER_* shots) or for the hardcoded default-audience text
// (Ring hand shots) — see buildAssetPromptSections and RING_HAND_1/2 below.
// Presenter demographic is resolved automatically from the confirmed
// customer category (never a separate manual picker) — the presenter
// library's own photo reference is deliberately NOT attached for Gents/Kids
// (see aiStudioJob.js), since compositing a real (adult female) reference
// photo would contradict this text. WOMEN/UNISEX keep today's behaviour
// completely unchanged — only GENTS and KIDS trigger this override.
const GENTS_PRESENTER_DESCRIPTOR =
  'an adult male model, approximately 25 to 40 years old, with a premium, well-groomed, natural Indian or internationally suitable commercial appearance and clean, contemporary styling — masculine but not exaggerated — wearing neutral, black, ivory, beige, navy or charcoal-toned clothing';

const GENTS_PRESENTER_BACKGROUND_NOTE =
  ' Use a soft, solid studio backdrop colour that elegantly complements the adult male presenter described above — refined and premium, not a busy pattern and not pure white.';

const GENTS_PRESENTER_NEGATIVE =
  'Do not generate a female presenter, a child presenter, feminine styling (unless explicitly required by the product), multiple models, or any additional rings, chains, bracelets, watches or accessories beyond the uploaded product. Do not use distracting clothing or backgrounds.';

const KIDS_PRESENTER_DESCRIPTOR =
  "a young child model, approximately 2 to 4 years old, clearly younger than four and not resembling an older child, teenager or adult — fully and modestly clothed in age-appropriate clothing, with a natural, happy expression, an innocent family-friendly pose, minimal styling, age-appropriate hair and no visible makeup, in the style of parent-supervised commercial photography";

const KIDS_PRESENTER_BACKGROUND_NOTE =
  ' Use a soft studio or natural lifestyle environment in gentle pastel, ivory, beige or neutral colours that elegantly complements the child model described above — refined, premium and family-friendly, not a busy pattern.';

// Kept as one shared block (not per asset-type) — the safety/scale
// requirements apply identically to every Kids shot, presenter or hand.
const KIDS_SAFETY_NEGATIVE =
  "Do not generate adult clothing, mature fashion styling, glamorous or romantic posing, heavy makeup, high heels, revealing clothing, adult body proportions, or a model that looks like a teenager or adult. Do not generate a disturbing, unsafe or uncomfortable pose, a child alone in a dangerous environment, multiple children unless explicitly requested, or any text, logos or watermarks. Show only the minimum body area required to demonstrate the product — do not force the child's full face into the image. The jewellery must be realistically sized for a child — do not render adult-sized jewellery unless the uploaded product is intentionally designed that way.";

// --- Gents presenter identity consistency (scoped to GENTS only) ---
//
// Problem: two independent text-only generations of "an adult male model"
// produce two different-looking men. Fix: generate ONE master identity
// portrait per job (via images.generate — no input image, pure text-to-
// image), store it on the job row, then feed it as a real image-edit
// reference image to every Gents PRESENTER_* generation — the same
// multi-image compositing technique already used for the ordinary
// (non-Gents) presenter flow, just with the images in the opposite role
// order (identity first, jewellery second — see GENTS_IDENTITY_LOCK_NOTE and
// generateShot's identityReferenceBuffer handling). Never touches Kids
// (still purely text-described, no photo library for it either) or Ring
// (its own separate hand-only workflow, untouched).
const GENTS_MASTER_PRESENTER_PROMPT =
  `Generate a premium commercial studio photograph of ${GENTS_PRESENTER_DESCRIPTOR}, shown from the chest up, facing the camera in a natural, relaxed pose, softly and evenly lit, on a plain neutral studio backdrop. Photorealistic, with clear, well-lit detail on the face, hair and skin so this photograph can serve as a fixed identity reference for later images. Show exactly one person. Do not include any jewellery, props, text, logos or watermarks.`;

// Generates the one-off master identity portrait for a Gents job — called at
// most once per job (aiStudioJob.js caches the result on
// ai_studio_jobs.gents_master_presenter_key and reuses it for every
// subsequent Gents presenter generation/regeneration in that job, never
// creating a new one unless the admin explicitly clicks "Change Gents
// Presenter").
export async function generateGentsMasterPresenter() {
  const openai = getClient();
  try {
    const response = await openai.images.generate({
      model: env.openaiImageModel,
      prompt: GENTS_MASTER_PRESENTER_PROMPT,
      size: '1024x1024',
      quality: 'medium',
      background: 'opaque',
      output_format: 'png',
      n: 1,
    });
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new AppError(502, 'Presenter identity generation did not return a result');
    return { buffer: Buffer.from(b64, 'base64'), prompt: GENTS_MASTER_PRESENTER_PROMPT };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw mapOpenAiError(err);
  }
}

// Tells the model explicitly which of the (now two) attached reference
// images controls what — without this, attaching an identity photo ahead of
// the jewellery photo would be ambiguous about which one the model should
// preserve where. Only ever used for a Gents PRESENTER_* shot (see the
// PRESENTER_* case in buildAssetPromptSections) — Ring, Kids, Women and
// Unisex never reach this text.
const GENTS_IDENTITY_LOCK_NOTE =
  "The first attached reference photo is the fixed adult male presenter identity for this generation — reproduce his exact face shape, facial features, skin tone, apparent age, hairline, hair colour, hairstyle, beard and moustache, and body proportions, so he is recognisably the same person shown in that photo. The second attached reference photo is the exact jewellery product — it controls only the jewellery design, never the presenter's identity. Only the presenter's pose, hand position, camera angle, crop, background composition, and the jewellery's metal colour or placement may differ from the identity reference photo.";

const GENTS_IDENTITY_LOCK_NEGATIVE =
  "Do not generate a different man than the one shown in the first (identity) reference photo. Do not change his apparent age, ethnicity or skin tone, and do not add or remove facial hair. Do not use any pose-reference person as the presenter. Do not blend multiple identities. Do not let the jewellery reference photo influence the presenter's face or body.";

function audiencePresenterOverrideFor(confirmedCustomerCategory) {
  if (confirmedCustomerCategory === 'GENTS') {
    return {
      descriptor: GENTS_PRESENTER_DESCRIPTOR,
      background: GENTS_PRESENTER_BACKGROUND_NOTE,
      negative: GENTS_PRESENTER_NEGATIVE,
    };
  }
  if (confirmedCustomerCategory === 'KIDS') {
    return {
      descriptor: KIDS_PRESENTER_DESCRIPTOR,
      background: KIDS_PRESENTER_BACKGROUND_NOTE,
      negative: KIDS_SAFETY_NEGATIVE,
    };
  }
  return null;
}

// Ring hand shots never go through the Presenter/PRESENTER_* path at all
// (see the RING_HAND_1/RING_HAND_2 cases below) — they need their own
// audience-aware hand-only text, since "existing jewellery-type rules such
// as Ring hand-only images must still take priority": for Gents/Kids this
// means the hand-only framing is kept exactly, only the hand's owner and its
// scale/styling change. WOMEN/UNISEX fall through to the existing hardcoded
// text further down, completely unchanged.
const GENTS_RING_HAND_1_TEXT =
  "Show an adult male model's hand only — do not show his face or any other part of his body. Position the hand naturally, with the exact uploaded ring placed on his ring finger, clearly visible and sharply focused. Use a premium jewellery-campaign composition. Generate realistic masculine hand anatomy with exactly five naturally proportioned fingers, realistic joints, and clean, well-groomed nails with no polish.";
const GENTS_RING_HAND_2_TEXT =
  "Use a closer crop of the same adult male model's hand, from a different angle than Hand Image 1 — do not show his face or any other part of his body. Keep the ring finger straight and unobstructed, with the exact uploaded ring placed naturally around it, clearly showing the ring design and band placement. Use a different hand position from Hand Image 1, keeping the composition natural and premium. Generate realistic masculine hand anatomy with exactly five naturally proportioned fingers, realistic joints, and clean, well-groomed nails with no polish.";
const GENTS_RING_HAND_NEGATIVE =
  'Do not show a female or child hand, or any part of a face or body — use an adult male hand only.';

const KIDS_RING_HAND_1_TEXT =
  "Show a young child's hand only, approximately 2 to 4 years old — do not show the child's face or any other part of their body. Position the hand naturally, with the exact uploaded ring placed on the correct finger at a scale realistic for a small child's hand, clearly visible and sharply focused. Generate realistic child hand anatomy with exactly five naturally proportioned, softly rounded fingers, with no manicure or nail polish.";
const KIDS_RING_HAND_2_TEXT =
  "Use a closer crop of the same young child's hand (approximately 2 to 4 years old), from a different angle than Hand Image 1 — do not show the child's face or any other part of their body. Keep the finger straight and unobstructed, with the exact uploaded ring placed naturally around it at a scale realistic for a small child's hand, clearly showing the ring design. Use a different hand position from Hand Image 1, keeping the composition natural and family-friendly. Generate realistic child hand anatomy with exactly five naturally proportioned, softly rounded fingers, with no manicure or nail polish.";
const KIDS_RING_HAND_NEGATIVE =
  "Do not show an adult or teenager's hand, or any part of a face or body — use a young child's hand only, approximately 2 to 4 years old, and do not render the ring at adult hand scale.";

function ringHandTextFor(confirmedCustomerCategory, slot) {
  if (confirmedCustomerCategory === 'GENTS') {
    return { text: slot === 1 ? GENTS_RING_HAND_1_TEXT : GENTS_RING_HAND_2_TEXT, negative: GENTS_RING_HAND_NEGATIVE };
  }
  if (confirmedCustomerCategory === 'KIDS') {
    return { text: slot === 1 ? KIDS_RING_HAND_1_TEXT : KIDS_RING_HAND_2_TEXT, negative: KIDS_RING_HAND_NEGATIVE };
  }
  return null;
}

const PLACEMENT_RULES = {
  RING: {
    location: "the ring finger",
    excluded:
      'No earrings, necklace, pendant, bracelet, bangle, nose pin, anklet, watch or other ring.',
  },
  EARRINGS: {
    location: 'the ears',
    excluded: 'No necklace, pendant, bracelet, bangle, ring, nose pin or other earrings.',
  },
  NECKLACE: {
    location: 'the neck',
    // Earrings aren't blanket-excluded here — a necklace set's own matching
    // earrings are part of the product (see NECKLACE_SET_NOTE).
    excluded:
      'No rings, bracelet, bangle, nose pin, additional necklace, or any earrings other than the matching earrings shown in the uploaded reference.',
  },
  PENDANT: {
    location: 'the neck',
    excluded: 'No earrings, rings, bracelet, bangle, nose pin or additional necklace.',
  },
  BRACELET: {
    location: 'one visible wrist',
    excluded: 'No rings, earrings, necklace, watch or additional wrist jewellery.',
  },
  BANGLE: {
    location: 'one visible wrist',
    excluded: 'No rings, earrings, necklace, watch or additional wrist jewellery.',
  },
};
const GENERIC_PLACEMENT_RULE = {
  location: 'its natural position',
  excluded:
    'No other jewellery of any kind — no rings, earrings, necklaces, pendants, bracelets, bangles, nose pins, anklets, watches, or additional pieces.',
};
function placementRuleFor(jewelleryType) {
  return PLACEMENT_RULES[jewelleryType] ?? GENERIC_PLACEMENT_RULE;
}

// Builds one asset's prompt as a structured section object — locked
// (non-editable) sections, an optional category-placement block (presenter
// shots only), an editable "creative" block (Customise Prompt in the Review
// Prompts panel overrides these, and only these), and a negative-instruction
// list. `assemblePrompt` below joins this into the actual string sent to the
// image API; the sections themselves are also returned as-is to the frontend
// for the "Locked Product Rules / Category Placement Rules / Creative
// Instructions / Negative Instructions" preview grouping.
function buildAssetPromptSections({
  assetType,
  confirmedType,
  template,
  presenter,
  creative,
  priorFailure,
  generateRoseGold,
  confirmedCustomerCategory,
  // Six-slot jobs: the presenter slot's resolved identity (see buildJobPlan).
  identity,
  // New jobs, catalogue slots: { geometry, supporting } reference roles.
  slotReferences,
}) {
  const metalColor = metalColorForAssetType(assetType, generateRoseGold);
  const metalColourNote = `The metal colour is ${metalColor.toLowerCase()} gold — preserve it exactly.`;
  const catalogueBackgroundNote = (
    metalColor === 'ROSE' ? RING_ROSE_CATALOGUE_BACKGROUND_NOTE : RING_GOLD_CATALOGUE_BACKGROUND_NOTE
  ).trim();
  const categoryLabel = confirmedType ? formatJewelleryType(confirmedType) : null;
  // Jewellery type (WHAT) always takes priority over customer category (WHO)
  // — this is resolved purely by which switch branch below runs (Ring hand
  // shots vs. the generic Presenter path), never by customer category. Only
  // GENTS/KIDS ever change anything here; WOMEN/UNISEX/unset are byte-for-
  // byte identical to the pre-existing behaviour.
  const audienceOverride = audiencePresenterOverrideFor(confirmedCustomerCategory);

  const locked = {
    productIdentity: 'Use the uploaded product reference as the only jewellery design.',
    confirmedCategory: categoryLabel ? `The confirmed product category is ${categoryLabel}.` : '',
    confirmedCustomerCategory: audienceOverride
      ? `The confirmed customer category is ${formatCustomerCategory(confirmedCustomerCategory)}.`
      : '',
    designPreservation:
      slotReferences && CATALOGUE_ASSET_TYPES.has(assetType)
        ? `${fidelityBlockFor(confirmedType)} ${PRODUCT_REPRODUCTION_NOTE} ${referenceOrderNote(slotReferences)}`
        : fidelityBlockFor(confirmedType),
    metalColour: metalColourNote,
    outputSpecs: 'Photorealistic, premium e-commerce jewellery photography. No text, logos, or watermarks.',
  };

  let categoryPlacement = '';
  let creativeDefaults;
  const negativeParts = ['Do not redesign, reinterpret or add/remove/resize/reposition any component.'];
  if (RING_ASSET_TYPE_SET.has(assetType)) negativeParts.push(RING_FIDELITY_EXTRA);
  if (hidesFastening(confirmedType)) negativeParts.push(HIDDEN_FASTENING_NOTE);
  if (confirmedType === 'NECKLACE') {
    negativeParts.push(CATALOGUE_ASSET_TYPES.has(assetType) ? NECKLACE_SET_NOTE_CATALOGUE : NECKLACE_SET_NOTE_PRESENTER);
  }
  if (CATALOGUE_ASSET_TYPES.has(assetType)) negativeParts.push(CATALOGUE_NO_PERSON_NOTE);
  if (metalColor === 'ROSE') negativeParts.push(ROSE_GOLD_CONVERSION_NOTE);

  switch (assetType) {
    case 'YELLOW_SLIGHT_ANGLE':
    case 'ROSE_SLIGHT_ANGLE':
    case 'YELLOW_ELEVATED_DETAIL':
    case 'RING_GOLD_SLIGHT_ANGLE':
    case 'RING_ROSE_SLIGHT_ANGLE':
    case 'RING_GOLD_ELEVATED_DETAIL': {
      const isElevated = assetType.endsWith('ELEVATED_DETAIL');
      creativeDefaults = {
        background: catalogueBackgroundNote,
        lighting: RING_CATALOGUE_LIGHTING_NOTE.trim(),
        composition: `${assetType.startsWith('RING_') ? RING_SIZE_NOTE : CATALOGUE_SIZE_NOTE} ${isElevated ? ELEVATED_DETAIL_COMPOSITION : SLIGHT_ANGLE_COMPOSITION}`,
        presenterPose: '',
        cameraAngle: '',
        additionalInstructions: '',
      };
      negativeParts.push(
        'Do not add props, text, hands, packaging, flowers, fabric or decorative elements — the background must stay plain pure white.',
        'Do not generate a full side profile or show the back of the jewellery.',
      );
      break;
    }
    case 'YELLOW_SIDE':
    case 'YELLOW_MACRO':
    case 'RING_GOLD_HERO':
    case 'RING_ROSE_HERO':
    case 'RING_GOLD_PROFILE':
    case 'RING_GOLD_MACRO': {
      const view = extraCatalogueView(assetType, categoryLabel);
      const isRingView = assetType.startsWith('RING_');
      creativeDefaults = {
        background: catalogueBackgroundNote,
        lighting: RING_CATALOGUE_LIGHTING_NOTE.trim(),
        composition: `${isRingView ? RING_SIZE_NOTE : CATALOGUE_SIZE_NOTE} ${view.composition}`,
        presenterPose: '',
        cameraAngle: '',
        additionalInstructions: '',
      };
      negativeParts.push(
        'Do not add props, text, hands, packaging, flowers, fabric or decorative elements — the background must stay plain pure white.',
        ...view.negatives,
      );
      break;
    }
    case 'YELLOW_FRONT':
    case 'ROSE_FRONT':
      creativeDefaults = {
        background: catalogueBackgroundNote,
        lighting: RING_CATALOGUE_LIGHTING_NOTE.trim(),
        composition: `${CATALOGUE_SIZE_NOTE} ${template.front_prompt}`,
        presenterPose: '',
        cameraAngle: '',
        additionalInstructions: '',
      };
      negativeParts.push('Do not add props, text, hands, packaging, flowers, fabric or decorative elements.');
      break;
    case 'YELLOW_HERO_45':
    case 'ROSE_HERO_45':
      creativeDefaults = {
        background: catalogueBackgroundNote,
        lighting: RING_CATALOGUE_LIGHTING_NOTE.trim(),
        composition: HERO_45_PROMPT,
        presenterPose: '',
        cameraAngle: '',
        additionalInstructions: '',
      };
      negativeParts.push(
        'Do not rotate the product so far that the primary design becomes hidden.',
        'Do not make the jewellery appear to float.',
        'Do not include hands, presenters, props, packaging, text, flowers, fabric or decorative elements.',
      );
      break;
    case 'PRESENTER_YELLOW_1':
    case 'PRESENTER_YELLOW_2':
    case 'PRESENTER_ROSE': {
      const rule = placementRuleFor(confirmedType);
      const itemLabel = categoryLabel ? categoryLabel.toLowerCase() : 'jewellery';
      categoryPlacement = `Place only this exact ${itemLabel} on the selected presenter's ${rule.location}. ${rule.excluded} Do not create a similar replacement design. Do not add accessory jewellery for styling. Keep the product clearly visible and unobstructed — do not allow clothing, hair or hands to cover it.`;
      // Gents ONLY: a real master identity photo is attached as the FIRST
      // input image (see generateShot's identityReferenceBuffer / GENTS_
      // IDENTITY_LOCK_NOTE) — every Gents presenter shot in this job is
      // guaranteed to have that master already generated before this text
      // is ever sent (aiStudioJob.js generates it once, up front), so this
      // branch can assume the photo will genuinely be there. Kids keeps the
      // existing text-only audienceOverride path unchanged (no photo
      // library exists for it); Women/Unisex keep the original presenter-
      // library-photo path unchanged.
      const isGentsIdentityLocked = confirmedCustomerCategory === 'GENTS';
      let presenterPoseText;
      let backgroundNote;
      if (isGentsIdentityLocked) {
        presenterPoseText = `Worn naturally by the same adult male presenter shown in the first attached identity reference photo — ${GENTS_PRESENTER_DESCRIPTOR}.`;
        backgroundNote = GENTS_PRESENTER_BACKGROUND_NOTE;
        categoryPlacement = `${categoryPlacement} ${GENTS_IDENTITY_LOCK_NOTE}`;
      } else if (confirmedCustomerCategory === 'KIDS' && identity?.source === IDENTITY_SOURCES.PRESENTER_PHOTO) {
        // A chosen child presenter: their photo is attached to both images.
        presenterPoseText = `Worn naturally by ${KIDS_PRESENTER_DESCRIPTOR}, matching the attached child presenter reference photo.`;
        backgroundNote = KIDS_PRESENTER_BACKGROUND_NOTE;
      } else if (audienceOverride) {
        presenterPoseText = `Worn naturally by ${audienceOverride.descriptor}.`;
        backgroundNote = audienceOverride.background;
      } else {
        const descriptor =
          presenter?.prompt_descriptor || (presenter ? `a presenter styled as "${presenter.style_label}"` : 'the selected presenter');
        presenterPoseText = `Worn naturally by ${descriptor}, matching the attached presenter reference photo.`;
        backgroundNote = PRESENTER_BACKGROUND_NOTE;
      }
      creativeDefaults = {
        background: backgroundNote.trim(),
        lighting: '',
        composition: `Framed as a ${template.presenter_placement} (${template.presenter_crop} crop). Use realistic product scale and placement.`,
        presenterPose: presenterPoseText,
        cameraAngle: '',
        additionalInstructions: '',
      };
      categoryPlacement = `${categoryPlacement} ${PRESENTER_SAME_IDENTITY_NOTE}${chainedIdentityNote(identity, metalColor)}`;
      if (assetType === 'PRESENTER_YELLOW_2') {
        categoryPlacement = `${categoryPlacement} Use a clearly different, category-appropriate pose or crop from Presenter Image 1.`;
      } else if (assetType === 'PRESENTER_ROSE') {
        categoryPlacement = `${categoryPlacement} This is the rose-gold comparison of the yellow-gold presenter image: keep the pose, crop and lighting the same so only the metal colour differs.`;
      }
      negativeParts.push(rule.excluded, 'Do not replace the uploaded product with a similar design.');
      if (isGentsIdentityLocked) {
        negativeParts.push(GENTS_PRESENTER_NEGATIVE, GENTS_IDENTITY_LOCK_NEGATIVE);
      } else if (audienceOverride) {
        negativeParts.push(audienceOverride.negative);
      }
      break;
    }
    case 'RING_HAND_1':
    case 'RING_HAND_ROSE': {
      const audienceHand = ringHandTextFor(confirmedCustomerCategory, 1);
      categoryPlacement =
        audienceHand?.text ??
        "Show a young female model — her face may be visible. Position her hand naturally near her face (for example resting near her cheek or chin), with the exact uploaded ring placed on her ring finger, clearly visible and sharply focused. Use a premium jewellery-campaign composition. Generate realistic hand anatomy with exactly five naturally proportioned fingers, realistic joints and fingernails, and a clean nude manicure.";
      creativeDefaults = {
        background: RING_HAND_BACKGROUND_NOTE.trim(),
        lighting: RING_HAND_LIGHTING_NOTE.trim(),
        composition: `${RING_SIZE_NOTE} ${RING_HAND_PLACEMENT_COMPOSITION}`,
        presenterPose: '',
        cameraAngle: '',
        additionalInstructions: '',
      };
      negativeParts.push(
        RING_HAND_NO_OTHER_JEWELLERY_NEGATIVE,
        'Do not create distorted fingers or unrealistic hand anatomy.',
        'Do not apply a background colour tied to the ring\'s metal colour — the background must be a natural, neutral photographic environment, not champagne, ivory, peach or rose-coloured.',
        ...RING_HAND_PLACEMENT_NEGATIVES,
      );
      if (audienceHand) negativeParts.push(audienceHand.negative);
      categoryPlacement = `${categoryPlacement} ${RING_HAND_SAME_IDENTITY_NOTE}${chainedIdentityNote(identity, metalColor)}`;
      if (assetType === 'RING_HAND_ROSE') {
        categoryPlacement = `${categoryPlacement} This is the rose-gold comparison of Hand Image 1: keep the pose, crop and lighting the same so only the metal colour differs.`;
      }
      break;
    }
    case 'RING_HAND_2': {
      const audienceHand = ringHandTextFor(confirmedCustomerCategory, 2);
      categoryPlacement =
        audienceHand?.text ??
        "Use a closer crop of a young female model's hand positioned near her face — the full face does not need to be visible. Keep the ring finger straight and unobstructed, with the exact uploaded ring placed naturally around it, clearly showing the ring design and band placement. Use a different hand position from Hand Image 1, keeping the composition natural and premium. Generate realistic hand anatomy with exactly five naturally proportioned fingers, realistic joints and fingernails, and a clean nude manicure.";
      creativeDefaults = {
        background: RING_HAND_BACKGROUND_NOTE.trim(),
        lighting: RING_HAND_LIGHTING_NOTE.trim(),
        composition: `${RING_SIZE_NOTE} ${RING_HAND_PLACEMENT_COMPOSITION}`,
        presenterPose: '',
        cameraAngle: '',
        additionalInstructions: '',
      };
      negativeParts.push(
        RING_HAND_NO_OTHER_JEWELLERY_NEGATIVE,
        'Do not create distorted fingers or unrealistic hand anatomy.',
        'Do not apply a background colour tied to the ring\'s metal colour — the background must be a natural, neutral photographic environment, not champagne, ivory, peach or rose-coloured.',
        'Use a hand pose visibly different from Hand Image 1 — do not reuse the same pose or camera angle.',
        ...RING_HAND_PLACEMENT_NEGATIVES,
      );
      if (audienceHand) negativeParts.push(audienceHand.negative);
      categoryPlacement = `${categoryPlacement} ${RING_HAND_SAME_IDENTITY_NOTE}${chainedIdentityNote(identity, metalColor)}`;
      break;
    }
    case 'RING_GOLD_FRONT':
    case 'RING_ROSE_FRONT': {
      const isRose = assetType === 'RING_ROSE_FRONT';
      creativeDefaults = {
        background: (isRose ? RING_ROSE_CATALOGUE_BACKGROUND_NOTE : RING_GOLD_CATALOGUE_BACKGROUND_NOTE).trim(),
        lighting: RING_CATALOGUE_LIGHTING_NOTE.trim(),
        // True Front View — a direct, symmetrical view of the ring's
        // decorative top, NOT the upright three-quarter stance used for the
        // Three-Quarter Side View below. This composition is deliberately
        // the opposite of that shot's in every stated respect.
        composition: `${RING_SIZE_NOTE} Photograph the ring's decorative top in a true, direct front view: the camera looks straight at the decorative face of the ring, as if looking down onto it, not standing it upright on its band. Position the centre stone in the exact visual centre of the frame, with the decorative bands extending clearly to the left and right so the front design reads approximately horizontal. Show the complete ring face and the full stone arrangement with minimal perspective distortion. The circular band opening may be partially visible behind the decorative face, but it must never be the dominant shape in the frame.`,
        presenterPose: '',
        cameraAngle: '',
        additionalInstructions: '',
      };
      negativeParts.push(
        'Do not add props, text, hands, packaging or decorative elements — the background must stay plain pure white.',
        'Do not stand the ring vertically upright on its band for this shot.',
        'Do not display the circular band opening as the main shape of the image.',
        'Do not rotate the ring to a 30-45 degree angle for this shot.',
        'Do not use the same orientation as the Three-Quarter Side View shot — this is a true, direct front view, not a three-quarter view.',
      );
      break;
    }
    case 'RING_GOLD_SIDE':
    case 'RING_ROSE_SIDE': {
      const isRose = assetType === 'RING_ROSE_SIDE';
      // Hardcoded opposite tilt directions (rather than a vague "make it
      // different" instruction) so the Gold and Rose Three-Quarter Side View
      // shots are reliably distinguishable from each other, on top of each
      // already being required to differ sharply from its own Front View.
      const directionNote = isRose
        ? ' Tilt the ring toward the opposite direction from the Gold Three-Quarter Side View shot (if Gold tilts left, tilt right, and vice versa) so the two Three-Quarter Side View images are clearly distinguishable.'
        : '';
      creativeDefaults = {
        background: (isRose ? RING_ROSE_CATALOGUE_BACKGROUND_NOTE : RING_GOLD_CATALOGUE_BACKGROUND_NOTE).trim(),
        lighting: RING_CATALOGUE_LIGHTING_NOTE.trim(),
        // Three-Quarter Side View — an elevated three-quarter angle with the
        // ring tilted approximately 35-45 degrees, decorative top still
        // facing the camera, replacing the old true 80-90° upright side
        // profile (client correction: the upright profile hid the front
        // motif and read as an unnatural product pose). Still required to
        // stay visually distinct from Front View: Front stays flat with no
        // tilt; this stays tilted, with both shoulders, the band opening and
        // setting height all visible.
        composition: `${RING_SIZE_NOTE} Photograph the ring from an elevated three-quarter angle with the ring tilted approximately 35-45 degrees — placed naturally, not standing completely upright on its band and not a direct front view. Keep the decorative top facing toward the camera with the complete front motif clearly visible, while also showing the circular band opening below the design, both the left and right shoulders, the band thickness and side construction, and the setting height and stone depth.${directionNote} Keep the complete ring inside the frame with safe margins and add a soft, realistic shadow directly underneath the product. Use a clean catalogue composition with different fabric folds from the matching Front View shot.`,
        presenterPose: '',
        cameraAngle: '',
        additionalInstructions: '',
      };
      negativeParts.push(
        'Do not use a direct front-facing angle for this shot.',
        'Do not stand the ring completely upright on its band or generate a true 80-90 degree side profile — use the elevated three-quarter tilt (approximately 35-45 degrees) described above.',
        'Do not hide the band opening, either shoulder, or flatten the setting.',
        'Do not crop any part of the ring out of frame.',
        'Do not repeat the orientation used for the Front View shot — the two must be visually and structurally different.',
      );
      break;
    }
    default:
      throw new Error(`Unknown asset type "${assetType}"`);
  }

  if (priorFailure) {
    negativeParts.push(`A previous attempt was rejected: ${priorFailure}. Correct this specific issue.`);
  }

  return {
    locked,
    categoryPlacement,
    creative: { ...creativeDefaults, ...(creative ?? {}) },
    negativeInstructions: negativeParts,
  };
}

function assemblePrompt({ locked, categoryPlacement, creative, negativeInstructions }) {
  return [
    locked.productIdentity,
    locked.confirmedCategory,
    locked.confirmedCustomerCategory,
    locked.designPreservation,
    locked.metalColour,
    creative.composition,
    creative.cameraAngle,
    creative.presenterPose,
    categoryPlacement,
    creative.background,
    creative.lighting,
    creative.additionalInstructions,
    ...negativeInstructions,
    locked.outputSpecs,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildPrompt({
  assetType,
  confirmedType,
  template,
  presenter,
  creative,
  priorFailure,
  generateRoseGold,
  confirmedCustomerCategory,
  identity,
  slotReferences,
}) {
  return assemblePrompt(
    buildAssetPromptSections({
      assetType,
      confirmedType,
      template,
      presenter,
      creative,
      priorFailure,
      generateRoseGold,
      confirmedCustomerCategory,
      identity,
      slotReferences,
    }),
  );
}

// Computes every planned asset's prompt without any DB/API calls — powers
// both the Review Prompts preview endpoint and what confirmJob persists onto
// each asset row at confirm time (so what's shown is exactly what's sent).
// confirmedCustomerCategory defaults to undefined/'WOMEN', which resolves to
// no audience override anywhere below — every existing caller that doesn't
// pass it keeps generating byte-identical prompts.
export function previewPromptsForJob({
  confirmedType,
  template,
  presenter,
  generateRoseGold,
  overridesByAssetType,
  confirmedCustomerCategory,
  // Preview may run before a presenter is picked; confirm requires one.
  requirePresenter = false,
  // { angle45, side } for new jobs (see referenceAvailability).
  references,
}) {
  const plan = buildJobPlan({
    jewelleryCategory: confirmedType,
    generateRoseGold,
    customerCategory: confirmedCustomerCategory,
    selectedPresenter: presenter,
    requirePresenter,
    references,
  });
  return plan.map(({ slotKey, assetType, kind, view, identity, references: slotReferences }) => {
    const override = overridesByAssetType?.[assetType];
    const sections = buildAssetPromptSections({
      assetType,
      confirmedType,
      template,
      presenter,
      creative: override,
      generateRoseGold,
      confirmedCustomerCategory,
      identity,
      slotReferences,
    });
    return {
      slotKey,
      kind,
      view,
      references: slotReferences ?? null,
      identity: identity ?? null,
      assetType,
      metalColor: metalColorForAssetType(assetType, generateRoseGold),
      mode: override ? 'customised' : 'recommended',
      lockedProductRules: [
        sections.locked.productIdentity,
        sections.locked.confirmedCategory,
        sections.locked.confirmedCustomerCategory,
        sections.locked.designPreservation,
        sections.locked.metalColour,
        sections.locked.outputSpecs,
      ].filter(Boolean),
      categoryPlacementRules: sections.categoryPlacement ? [sections.categoryPlacement] : [],
      creativeInstructions: sections.creative,
      negativeInstructions: sections.negativeInstructions,
      finalPrompt: assemblePrompt(sections),
    };
  });
}

function extensionFor(mimetype) {
  return mimetype === 'image/png' ? 'png' : mimetype === 'image/webp' ? 'webp' : 'jpg';
}

// One images.edit() call per asset, always against the ORIGINAL jewellery
// reference buffer — never a previously-generated shot (plan §4 correction:
// "Every generated image must use the original reference image"). Presenter
// asset types additionally pass the presenter's own reference photo as a
// second input image — gpt-image-2 accepts an array of images per edit call
// — so the model composites the real jewellery onto a real presenter photo
// rather than only working from a text description. No resize here; full-res
// output is stored as-is, variant derivation happens once on import.
export async function generateShot({
  referenceBuffer,
  mimetype,
  template,
  assetType,
  confirmedType,
  presenter,
  presenterReferenceBuffer,
  identityReferenceBuffer,
  creative,
  priorFailure,
  promptOverride,
  generateRoseGold,
  confirmedCustomerCategory,
  outputSlot,
  // [{ role, buffer }] — the angled/side reference(s) for this catalogue slot.
  viewReferenceBuffers = [],
}) {
  const openai = getClient();
  const extension = extensionFor(mimetype);
  // Prefer the prompt already reviewed/confirmed on the Review Prompts panel
  // and persisted at confirm time (assembled_final_prompt) — guarantees what
  // the admin saw is exactly what gets sent. Only recomputed when there's a
  // prior-failure correction to inject (a retry after failed validation) or
  // for the rare case nothing was persisted yet.
  const prompt =
    promptOverride ??
    buildPrompt({
      assetType,
      confirmedType,
      template,
      presenter,
      creative,
      priorFailure,
      generateRoseGold,
      confirmedCustomerCategory,
      identity: outputSlot?.identity,
      slotReferences: outputSlot?.references,
    });

  // Identity reference (Gents master or the first presenter image) goes
  // first, then the jewellery — the order the identity notes describe.
  const request = buildGenerationRequest({
    outputSlot,
    jewelleryReference: { buffer: referenceBuffer, mimetype, filename: `reference.${extension}` },
    presenterReference: presenterReferenceBuffer ? { buffer: presenterReferenceBuffer } : null,
    identityReference: identityReferenceBuffer ? { buffer: identityReferenceBuffer } : null,
    viewReferences: viewReferenceBuffers,
    prompt,
  });

  try {
    const files = await Promise.all(
      request.images.map((img) => toFile(img.buffer, img.filename, { type: img.mimetype })),
    );
    const image = files.length === 1 ? files[0] : files;

    const response = await openai.images.edit({
      model: env.openaiImageModel,
      image,
      prompt,
      size: '1024x1024',
      quality: 'medium',
      background: 'opaque',
      output_format: 'png',
      n: 1,
    });
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new AppError(502, 'Image generation did not return a result');
    return { buffer: Buffer.from(b64, 'base64'), prompt };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw mapOpenAiError(err);
  }
}

export function presenterReferenceKeyFor(assetType) {
  return PRESENTER_POSE_REFERENCE[assetType] ?? null;
}

const ValidationSchema = z.object({
  validationStatus: z.enum(['passed', 'warning', 'failed']),
  detectedJewelleryTypes: z.array(z.enum(JEWELLERY_TYPES)),
  expectedJewelleryType: z.enum(JEWELLERY_TYPES),
  additionalOrnamentsDetected: z.array(z.string()),
  placementStatus: z.enum(['correct', 'incorrect', 'partially_obscured', 'not_applicable']),
  metalColourStatus: z.enum(['correct', 'incorrect']),
  productSimilarityScore: z.number().min(0).max(1),
  validationMessages: z.array(z.string()),
});

const VALIDATION_SYSTEM_PROMPT = `You are a jewellery product-photo quality reviewer. You are shown two images: the GENERATED result (first image) and the ORIGINAL product reference photo (second image), plus the expected jewellery category and metal colour as text. Check: (1) the generated image's jewellery category matches what was expected, (2) no additional or unrelated jewellery is visible anywhere in the image beyond the one confirmed product — rings, earrings, necklaces, pendants, bracelets, bangles, nose pins, anklets, watches, or any other piece, (3) the product is correctly placed, fully visible, sharply focused, and not obscured by hands, hair or clothing, (4) the metal colour matches what was requested, (5) the generated jewellery closely matches the original reference's design — same stone count, stone shapes, settings, prongs and proportions, not a similar replacement. Set validationStatus to "failed" for a wrong category or any additional ornament detected, "warning" for a real but minor issue (e.g. partial obstruction, slight colour mismatch), and "passed" only when everything checks out. Always include specific, actionable validationMessages, e.g. "Failed: Expected Ring, but Bracelet was detected." or "Warning: Ring is partially covered by the presenter's finger." Additional per-asset-type instructions may follow in the user message — they refine, and can override, rule (3) above for that specific image (e.g. a Ring hand-model shot is SUPPOSED to show a hand). A third image may also be attached — a fixed presenter identity reference; when present, the user message explains what to check it against.`;

// Ring hand shots are SUPPOSED to show a hand — rule (3) in the system
// prompt above (generic "not obscured by hands") would otherwise wrongly
// flag every one of them. Front/Side shots each get an explicit orientation
// checklist — a single vision call only sees ITS OWN generated image (no
// true side-by-side comparison against its sibling shot is implemented),
// but a Front that actually came out as a rotated/upright view will fail its
// own required-features list below, and likewise for a Side that came out
// front-facing — which in practice catches the same "these two look the
// same" failure mode the client described, without a separate cross-asset
// validation pass.
function ringValidationContextFor(assetType) {
  if (assetType === 'RING_HAND_1' || assetType === 'RING_HAND_2' || assetType === 'RING_HAND_ROSE') {
    return ' This is a Ring lifestyle hand-wearing shot — a hand, and possibly the model\'s face, are expected and must not be flagged as an obstruction. The background is a natural, neutral photographic environment (studio grey/white/black, soft interior, subtle beige) and must NOT be flagged just for not matching a metal-coloured catalogue background — only flag the background if it is champagne/ivory/peach/rose-tinted (i.e. tied to the metal colour), which is explicitly disallowed here. Pass only when: the ring is physically wrapped around the ring finger — not floating above the skin, not pasted on as a flat circular shape, not embedded inside the finger; the ring sits on the correct ring finger; the ring closely matches the uploaded product reference (same stones, same band structure — not just a loosely similar ring); hand anatomy is realistic; and no other jewellery (earrings, necklace, bracelet, watch, additional ring) is visible on the model. Set validationStatus to "failed" (not "warning") when: the ring is on the wrong finger, the ring appears to float above the skin or is pasted on flat, the ring appears embedded inside the finger, more than one ring is visible, any other jewellery item is visible, hand anatomy is unrealistic (wrong finger count, malformed joints), or the generated ring is only loosely similar to the reference rather than an accurate reproduction.';
  }
  if (assetType === 'RING_GOLD_FRONT' || assetType === 'RING_ROSE_FRONT') {
    return ' This is a Ring TRUE FRONT VIEW — a direct, symmetrical view of the decorative top, not an upright three-quarter angle. It passes only when: the decorative ring face is the dominant visible element; the centre stone is centrally positioned; the left and right decorative bands are clearly visible extending outward; the ring is viewed directly from above/toward its decorative face; the image does NOT resemble an upright side view. Set validationStatus to "failed" (not "warning") if the ring is standing upright on its band, if the circular band opening is the dominant shape, or if this looks like a three-quarter/rotated angle rather than a true direct front view — this is a common and important failure mode to catch.';
  }
  if (assetType === 'RING_GOLD_SIDE' || assetType === 'RING_ROSE_SIDE') {
    return ' This is a Ring THREE-QUARTER SIDE VIEW — an elevated three-quarter angle with the ring tilted approximately 35-45 degrees, not a direct front view and not a true 80-90 degree upright side profile. It passes only when: the ring is placed naturally at that tilt rather than standing completely upright on its band; the decorative top still faces toward the camera with the complete front motif clearly visible; the circular band opening is clearly visible below the design; both the left and right shoulders are visible; band thickness and side construction are visible; the centre-stone setting height and stone depth are visible; the complete ring is inside the frame with safe margins; a soft, realistic shadow is visible underneath the product. Set validationStatus to "failed" (not "warning") if the shot is a direct front view with no tilt, if the ring stands fully upright on its band (a true 80-90 degree side profile), if the band opening or either shoulder is hidden, if the setting appears flattened rather than showing real height, or if any part of the ring is cropped out of frame.';
  }
  return '';
}

// Necklace sets — the system prompt's rule (2) ("no additional jewellery")
// would otherwise flag a set's own matching earrings as an extra ornament.
// Six-image jobs' extra catalogue views — each checked against its own angle.
// The background check is lenient: the model's white usually comes back
// near-white around the shadow, which must not fail an otherwise good shot.
const EXTRA_VIEW_VALIDATION_CONTEXT = {
  RING_GOLD_HERO:
    ' This is the Ring HERO THREE-QUARTER VIEW — the ring stands upright at an approximately 40-45 degree three-quarter angle, showing the centre stone, the decorative top and the band. Set validationStatus to "failed" if any part of the ring is cropped out of frame, or if this is a flat top-down view or a pure side profile.',
  RING_GOLD_PROFILE:
    ' This is the Ring SIDE-PROFILE VIEW — the ring stands upright and is seen from the side, showing the band profile, setting height, prongs and centre-stone mounting. Set validationStatus to "failed" if this looks like a three-quarter hero view or a front view rather than a genuine side profile, or if any part of the ring is cropped out of frame.',
  RING_GOLD_MACRO:
    ' This is the Ring MACRO DETAIL VIEW — a close-up of the main design. Part of the band extending outside the frame is EXPECTED and must not be flagged. Set validationStatus to "failed" only if an important stone or primary design detail is cropped out.',
  YELLOW_SIDE:
    ' This is the SIDE-PROFILE VIEW — the piece seen from the side, showing its thickness, depth and construction. Set validationStatus to "failed" if this looks like the 45-degree hero view or a front view rather than a genuine side profile, or if any part of the piece is cropped out of frame.',
  YELLOW_MACRO:
    ' This is the MACRO DETAIL VIEW — a close-up of the main design. Part of a chain, band or similar extending outside the frame is EXPECTED and must not be flagged. Set validationStatus to "failed" only if an important stone or primary design detail is cropped out.',
};
EXTRA_VIEW_VALIDATION_CONTEXT.RING_ROSE_HERO = EXTRA_VIEW_VALIDATION_CONTEXT.RING_GOLD_HERO;
const LENIENT_WHITE_BACKGROUND_VALIDATION =
  ' The background is a white studio background: a soft contact shadow, a slight light-grey falloff or an off-white tone are expected and must NOT be flagged. Only a clearly coloured, dark, patterned or fabric background is worth a "warning", never "failed".';

function extraViewValidationContextFor(assetType) {
  const context = EXTRA_VIEW_VALIDATION_CONTEXT[assetType];
  return context ? `${context}${LENIENT_WHITE_BACKGROUND_VALIDATION}` : '';
}

function catalogueValidationContextFor(assetType) {
  if (!CATALOGUE_ASSET_TYPES.has(assetType)) return '';
  return ' This is a PRODUCT-ONLY catalogue image (no model). Set validationStatus to "failed" if any person, model, mannequin, bust, face, neck, ears, hands or other body part appears anywhere in the generated image.';
}

// Necklace / Bracelet / Anklet: a visible fastening fails; a hidden one is
// what was asked for and must not be read as a design change.
export function hiddenFasteningValidationContextFor(confirmedType) {
  if (!hidesFastening(confirmedType)) return '';
  return ' This category must not show its fastening: set validationStatus to "failed" if any clasp, hook, lock, lobster clasp, spring-ring clasp, S-hook, extension-chain end or other fastening mechanism is visible in the generated image. The fastening being out of sight is expected and must NOT be flagged as a missing component or design change — but set validationStatus to "failed" if the jewellery was altered to hide it, e.g. the chain is cut or shortened, a gap is closed with links that are not in the reference, or a new connector was added.';
}

function necklaceValidationContextFor(confirmedType) {
  if (confirmedType !== 'NECKLACE') return '';
  return ' This is the Necklace category: if the original reference shows the necklace together with matching earrings (a necklace set), those earrings are part of the product and must NOT be flagged as additional jewellery. In that case set validationStatus to "failed" if the generated image is missing the necklace or the matching earrings, or — on a presenter shot — if the presenter is not wearing both (necklace on the neck, matching earrings on the ears). Also compare the earrings closely with the reference: set validationStatus to "failed" if their type, size or length differs — e.g. the reference shows small stud earrings but the generated image shows drop, dangle, chandelier or hoop earrings, or the earrings are visibly longer or larger than in the reference — and say so explicitly, e.g. "Failed: Earrings changed from studs to long drops." If the reference shows only a necklace, set validationStatus to "failed" if any earrings appear in the generated image.';
}

// A presenter shot showing a hand only (Ring's dedicated workflow) has no
// visible model demographic to check — every other presenter-eligible shot
// (PRESENTER_* and, for a non-Ring category, any future hand/body shot) does.
const NO_DEMOGRAPHIC_ASSET_TYPES = new Set(['RING_GOLD_HERO', 'RING_GOLD_PROFILE', 'RING_GOLD_MACRO', 'RING_ROSE_HERO', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE']);

// Audience-specific validation criteria (spec's "VALIDATION" section) —
// appended alongside ringValidationContextFor, never replacing it, so a
// Ring + Gents/Kids hand shot is checked for BOTH the existing hand-only
// physical-placement rules AND the correct model demographic. WOMEN/UNISEX
// add nothing here, same as they add nothing to the generation prompt.
function audienceValidationContextFor(confirmedCustomerCategory, assetType) {
  if (NO_DEMOGRAPHIC_ASSET_TYPES.has(assetType)) return '';
  if (confirmedCustomerCategory === 'GENTS') {
    const isRingHand = assetType === 'RING_HAND_1' || assetType === 'RING_HAND_2' || assetType === 'RING_HAND_ROSE';
    return ` The confirmed customer category is GENTS — verify the presenter${isRingHand ? "'s hand" : ''} is unambiguously that of an adult male (not a female or child), that the jewellery is worn in the correct location, that no unrelated jewellery is visible, that the product design matches the reference, and that product scale and placement are realistic. Set validationStatus to "failed" if the presenter reads as female or as a child.`;
  }
  if (confirmedCustomerCategory === 'KIDS') {
    const isRingHand = assetType === 'RING_HAND_1' || assetType === 'RING_HAND_2' || assetType === 'RING_HAND_ROSE';
    return ` The confirmed customer category is KIDS — verify the presenter${isRingHand ? "'s hand" : ''} visually appears approximately 2 to 4 years old (not an older child, teenager or adult), that the child (where visible) is fully and appropriately clothed with age-appropriate, family-friendly styling, that the jewellery is worn in the correct location at a scale appropriate for a small child, that no additional jewellery is present, that the product design matches the reference, and that the image is family-friendly and commercially suitable. Set validationStatus to "failed" if the model looks older than approximately 4, if styling is adult/mature, or if the jewellery is rendered at adult scale.`;
  }
  return '';
}

// Runs after every successful generation (Problem 1 & 2 downstream): a second
// vision call comparing the freshly generated image against the original
// product reference, checking category/ornament/placement/metal/similarity.
// Never blocks the asset from being READY/viewable — this is an orthogonal
// gate on *import*, applied by the controller (see importAsset/updateAssetSelection).
export async function validateGeneratedImage({
  generatedBuffer,
  referenceBuffer,
  referenceMimetype,
  confirmedType,
  metalColor,
  assetType,
  confirmedCustomerCategory,
  // Gents only — the job's master presenter portrait, so this generated
  // shot can be checked against the SAME fixed identity every other Gents
  // presenter shot in the job is also checked against (rather than a
  // pairwise comparison between the two generated shots themselves).
  identityReferenceBuffer,
  identityReferenceMimetype,
  // 'GENTS_MASTER' (default) | 'CHILD' | 'HAND' — what the third image is.
  identityKind = 'GENTS_MASTER',
}) {
  if (!env.openaiVisionModel) {
    throw new AppError(503, 'AI validation is not configured');
  }
  const openai = getClient();
  const generatedBase64 = generatedBuffer.toString('base64');
  const referenceBase64 = referenceBuffer.toString('base64');

  let text = `Expected jewellery category: ${confirmedType}. Expected metal colour: ${metalColor}. Asset type: ${assetType}. The first image is the generated result; the second image is the original product reference.${ringValidationContextFor(assetType)}${extraViewValidationContextFor(assetType)}${necklaceValidationContextFor(confirmedType)}${hiddenFasteningValidationContextFor(confirmedType)}${catalogueValidationContextFor(assetType)}${audienceValidationContextFor(confirmedCustomerCategory, assetType)}`;

  const content = [
    { type: 'text', text },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${generatedBase64}`, detail: 'high' } },
    { type: 'image_url', image_url: { url: `data:${referenceMimetype};base64,${referenceBase64}`, detail: 'high' } },
  ];

  if (identityReferenceBuffer && identityKind !== 'GENTS_MASTER') {
    text +=
      identityKind === 'HAND'
        ? ' A third image is also attached — the first hand image from this same set. Verify the hand in the GENERATED result (first image) is the same hand: same skin tone, finger proportions, nail length, nail shape and nail colour. If it is clearly a different hand, this is a "Presenter Identity Mismatch" — set validationStatus to "failed" and say so explicitly in validationMessages.'
        : ' A third image is also attached — the first presenter image from this same set. Verify the child in the GENERATED result (first image) is the same child: same face, apparent age, skin tone, hairstyle, clothing and body proportions. If it is clearly a different child, this is a "Presenter Identity Mismatch" — set validationStatus to "failed" and say so explicitly in validationMessages.';
    content[0].text = text;
    content.push({
      type: 'image_url',
      image_url: { url: `data:${identityReferenceMimetype ?? 'image/png'};base64,${identityReferenceBuffer.toString('base64')}`, detail: 'high' },
    });
  } else if (identityReferenceBuffer) {
    text +=
      ' A third image is also attached — the fixed master presenter identity reference for this generation job. Verify the presenter shown in the GENERATED result (first image) is unambiguously the same man shown in this third identity reference image: matching face shape, facial features, skin tone, apparent age, hairline, hair colour, hairstyle, and beard/moustache. If the presenter appears to be a different person, a different apparent age, or has different facial hair than the identity reference, this is a "Presenter Identity Mismatch" — set validationStatus to "failed" and say so explicitly in validationMessages, e.g. "Presenter Identity Mismatch: generated presenter\'s face/beard do not match the identity reference."';
    content[0].text = text;
    const identityBase64 = identityReferenceBuffer.toString('base64');
    content.push({
      type: 'image_url',
      image_url: { url: `data:${identityReferenceMimetype ?? 'image/png'};base64,${identityBase64}`, detail: 'high' },
    });
  }

  try {
    const completion = await openai.chat.completions.parse({
      model: env.openaiVisionModel,
      messages: [
        { role: 'system', content: VALIDATION_SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      response_format: zodResponseFormat(ValidationSchema, 'generation_validation'),
    });
    return completion.choices[0].message.parsed;
  } catch (err) {
    throw mapOpenAiError(err);
  }
}
