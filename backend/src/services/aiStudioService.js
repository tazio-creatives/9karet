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
];

// Ring-only output structure (9karet) — exactly four Yellow Gold catalogue
// shots per reference, in this fixed order: Hero three-quarter, Front/Top,
// Side profile, Macro detail. 9karet sells no rose gold and Ring gets no
// hand/lifestyle shots. Replaces the generic 7-value vocabulary above
// whenever confirmedType === 'RING'.
export const RING_ASSET_TYPES = ['RING_GOLD_HERO', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_GOLD_MACRO'];

// The previous Ring workflow's hand and rose-gold slots. Never generated any
// more — kept only so images from jobs made before the change still load
// and can still be imported.
export const LEGACY_RING_ASSET_TYPES = ['RING_HAND_1', 'RING_HAND_2', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE'];
const RING_ASSET_TYPE_SET = new Set([...RING_ASSET_TYPES, ...LEGACY_RING_ASSET_TYPES]);

// File-name stem for each Ring output (yellow_gold_hero, …), used in the
// generated image's storage key.
export const RING_OUTPUT_NAMES = {
  RING_GOLD_HERO: 'yellow_gold_hero',
  RING_GOLD_FRONT: 'yellow_gold_front',
  RING_GOLD_SIDE: 'yellow_gold_side',
  RING_GOLD_MACRO: 'yellow_gold_macro',
};

// Mirrors the DB CHECK constraint (latest: the 9karet ring catalogue
// migration) — must stay in lockstep with it, this is the single source of
// truth on the JS side.
export const ASSET_DISPLAY_ORDER = {
  YELLOW_FRONT: 0,
  YELLOW_HERO_45: 1,
  ROSE_FRONT: 2,
  ROSE_HERO_45: 3,
  PRESENTER_YELLOW_1: 4,
  PRESENTER_YELLOW_2: 5,
  PRESENTER_ROSE: 6,
  RING_GOLD_HERO: 0,
  RING_GOLD_FRONT: 1,
  RING_GOLD_SIDE: 2,
  RING_GOLD_MACRO: 3,
  RING_HAND_1: 4,
  RING_HAND_2: 5,
  RING_ROSE_FRONT: 6,
  RING_ROSE_SIDE: 7,
};

// Which asset types get generated for a job. Ring is a completely separate,
// fixed output structure — always the same four Yellow Gold shots, whatever
// the Rose Gold toggle says.
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
const ALWAYS_ROSE_GOLD_TYPES = new Set(['NECKLACE']);

// 9karet has no rose gold for Ring, so a Ring job never records it as on.
const NEVER_ROSE_GOLD_TYPES = new Set(['RING']);

export function effectiveGenerateRoseGold(confirmedType, requested) {
  if (NEVER_ROSE_GOLD_TYPES.has(confirmedType)) return false;
  return ALWAYS_ROSE_GOLD_TYPES.has(confirmedType) ? true : requested;
}

export function resolveAssetTypesForJob({ generateRoseGold, hasPresenter, confirmedType }) {
  if (confirmedType === 'RING') return [...RING_ASSET_TYPES];
  const types = ['YELLOW_FRONT', 'YELLOW_HERO_45'];
  if (generateRoseGold) types.push('ROSE_FRONT', 'ROSE_HERO_45');
  if (hasPresenter) {
    types.push('PRESENTER_YELLOW_1');
    types.push(generateRoseGold ? 'PRESENTER_ROSE' : 'PRESENTER_YELLOW_2');
  }
  return types;
}

// RING_HAND_2 (a legacy slot) took its metal from the Rose Gold toggle —
// every other asset type is unambiguous from its name alone, so the extra
// param is a no-op for them.
export function metalColorForAssetType(assetType, generateRoseGold = true) {
  if (assetType === 'RING_HAND_2') return generateRoseGold ? 'ROSE' : 'YELLOW';
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
const RING_SIZE_NOTE = 'Create a premium square jewellery photograph at 816 × 816px (1:1).';

// The four Ring catalogue views, in output order. Each must give genuinely
// new information — the side profile is a true side view, not the hero
// rotated a little, and the macro is the only shot allowed to crop the band.
const RING_CATALOGUE_SHOTS = {
  RING_GOLD_HERO: {
    composition:
      'Hero three-quarter view — the primary product and product-list image. Stand the complete ring upright on its band and turn it to an approximately 40-45 degree three-quarter angle, so the centre stone, the decorative top and the band are all clearly visible. Centre the ring with balanced white space around it and keep the complete ring inside the frame.',
    negatives: ['Do not crop any part of the ring out of frame.', 'Do not use a flat top-down view or a pure side profile for this shot.'],
  },
  RING_GOLD_FRONT: {
    composition:
      'Front/top view. Lay the ring horizontally and photograph the complete decorative top from the front or a slightly elevated top angle, so the centre stone and every visible small stone are clearly displayed. Keep the complete decorative section visible and the complete ring inside the frame. This view must look clearly different from the upright three-quarter hero view.',
    negatives: [
      'Do not crop any part of the ring out of frame.',
      'Do not stand the ring upright at a three-quarter angle — that is the hero view, and this shot must differ from it.',
    ],
  },
  RING_GOLD_SIDE: {
    composition:
      'Side-profile view. Stand the ring upright and photograph it from the side, so the band profile, the setting height, the prongs and the centre-stone mounting are clearly shown. Preserve the original band thickness and structural proportions. The angle must give genuine side-profile information. Keep the complete ring inside the frame.',
    negatives: [
      'Do not crop any part of the ring out of frame.',
      'Do not reuse or slightly rotate the hero three-quarter view — this must be a true side profile.',
      'Do not show the ring face-on from the front.',
    ],
  },
  RING_GOLD_MACRO: {
    composition:
      'Macro detail view. A close-up of the main design: the centre stone, the prongs, the small stones, the metal finishing and the setting details, sharp and clearly lit. Keep the centre design as the focal point. Part of the band may extend outside the frame.',
    negatives: [
      'Do not crop any important stone or primary design detail out of frame — only the band may be cut off.',
      'Do not invent texture, engraving or stones that are not visible on the reference.',
    ],
  },
};

// Ring catalogue rules shared by all four shots (9karet spec): one lighting
// and shadow style, yellow gold only, and stone colours held exactly. 9karet
// sets coloured gemstones as well as colourless ones, so "keep diamonds
// colourless" is worded so it can never wash out a ruby or emerald.
const RING_CATALOGUE_COMMON_NOTE =
  'This is one of a set of four Ring catalogue images of the same ring (Hero three-quarter, Front/Top, Side profile, Macro detail): use the same lighting, white balance and soft shadow style as the rest of the set. The metal is polished yellow gold only — realistic and premium, a natural warm yellow, never excessively orange. Keep colourless stones (diamonds, cubic zirconia) colourless and naturally reflective, and keep every coloured gemstone its exact original colour. Preserve the exact number, shape, size and position of every stone, the centre-stone shape, the prong count and placement, the band shape, thickness and proportions, and any asymmetrical detail.';
const RING_CATALOGUE_COMMON_NEGATIVES = [
  'Do not generate a rose-gold or white-gold version — yellow gold only.',
  'Do not show hands, fingers, a model, props, packaging, text, logos, borders or badges.',
  'Do not use a coloured, gradient or textured background — plain clean white only.',
  'Do not change the ring into another jewellery category.',
  'Do not add unrealistic reflections or artificial sparkle effects.',
  'Do not make the yellow gold excessively orange.',
];

// Appended as an extra negative instruction on every Ring asset type, on top
// of the generic FIDELITY_BLOCK every asset type already gets — Ring's
// stricter fidelity list (no bangle/bracelet conversion, no mixing in
// elements from pose/background reference images) doesn't apply to any other
// category. Client correction raised this to "highest priority": pose and
// background reference images may only ever influence pose/angle/background,
// never the jewellery design itself, and a visually attractive but
// inaccurate result must never be treated as good enough.
const RING_FIDELITY_EXTRA =
  'The uploaded product image is the only source of truth for the ring design — preserve the exact number, shape and position of every stone, the centre-stone shape and setting, band count and structure, pavé arrangement, curves/crossings/gaps, proportions, setting height, metal thickness and every decorative detail. Do not invent additional stones, remove stones, create a second ring, change the centre stone, change the band design, simplify the construction, or mirror/symmetrise an asymmetric detail. Do not redesign the ring to suit the pose. Pose and background reference images may influence only the camera angle or background — never the jewellery design. A visually attractive but structurally inaccurate result is not acceptable — do not add, remove or move stones, change the motif or band design, add another band, invent a different setting, convert the ring into a bangle or bracelet, or mix the uploaded ring with any design elements from pose or background reference images.';

// Appended as an extra negative instruction on every asset type for a
// confirmed Bracelet, on top of whatever that asset type's own negatives
// already are — Bracelet is otherwise just the generic (non-Ring) prompt
// path, so this is the only Bracelet-specific rule. Applies to every
// generated view (front, hero angle, presenter) and every metal colour,
// without changing which asset types are generated or their order.
const BRACELET_CLASP_HIDDEN_NOTE =
  "This is a Bracelet — do not show the bracelet's lock, clasp, hook or fastening mechanism anywhere in this image. Position or rotate the bracelet so the locking area stays hidden behind the product itself or outside the visible angle, while keeping the bracelet looking naturally closed and continuous. Do not invent a decorative lock, clasp or connector that is not part of the original design. Preserve the bracelet's original design, stones, metal colour, proportions and pattern exactly.";

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
const CATALOGUE_ASSET_TYPES = new Set(['YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45', ...RING_ASSET_TYPES]);

// Audience-specific presenter description (Gents/Kids), substituted for
// whichever real presenter's own prompt_descriptor would otherwise be used
// (non-Ring PRESENTER_* shots) or for the hardcoded default-audience text
// (unused for Ring, which has no presenter or hand shots).
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
    designPreservation: FIDELITY_BLOCK,
    metalColour: metalColourNote,
    outputSpecs: 'Photorealistic, premium e-commerce jewellery photography. No text, logos, or watermarks.',
  };

  let categoryPlacement = '';
  let creativeDefaults;
  const negativeParts = ['Do not redesign, reinterpret or add/remove/resize/reposition any component.'];
  if (RING_ASSET_TYPE_SET.has(assetType)) negativeParts.push(RING_FIDELITY_EXTRA);
  if (confirmedType === 'BRACELET') negativeParts.push(BRACELET_CLASP_HIDDEN_NOTE);
  if (confirmedType === 'NECKLACE') {
    negativeParts.push(CATALOGUE_ASSET_TYPES.has(assetType) ? NECKLACE_SET_NOTE_CATALOGUE : NECKLACE_SET_NOTE_PRESENTER);
  }
  if (CATALOGUE_ASSET_TYPES.has(assetType)) negativeParts.push(CATALOGUE_NO_PERSON_NOTE);

  switch (assetType) {
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
      negativeParts.push(rule.excluded, 'Do not replace the uploaded product with a similar design.');
      if (isGentsIdentityLocked) {
        negativeParts.push(GENTS_PRESENTER_NEGATIVE, GENTS_IDENTITY_LOCK_NEGATIVE);
      } else if (audienceOverride) {
        negativeParts.push(audienceOverride.negative);
      }
      break;
    }
    // Ring (9karet): four Yellow Gold catalogue shots, each from a genuinely
    // different viewpoint. Shared rules (lighting, stones, gold tone) come
    // from RING_CATALOGUE_COMMON_NOTE / _NEGATIVES; each case adds only its
    // own angle and framing.
    case 'RING_GOLD_HERO':
    case 'RING_GOLD_FRONT':
    case 'RING_GOLD_SIDE':
    case 'RING_GOLD_MACRO': {
      const shot = RING_CATALOGUE_SHOTS[assetType];
      creativeDefaults = {
        background: RING_GOLD_CATALOGUE_BACKGROUND_NOTE.trim(),
        lighting: RING_CATALOGUE_LIGHTING_NOTE.trim(),
        composition: `${RING_SIZE_NOTE} ${shot.composition}`,
        presenterPose: '',
        cameraAngle: '',
        additionalInstructions: '',
      };
      categoryPlacement = RING_CATALOGUE_COMMON_NOTE;
      negativeParts.push(...RING_CATALOGUE_COMMON_NEGATIVES, ...shot.negatives);
      break;
    }
    case 'RING_HAND_1':
    case 'RING_HAND_2':
    case 'RING_ROSE_FRONT':
    case 'RING_ROSE_SIDE':
      throw new AppError(400, 'This Ring image type is no longer generated — start a new generation for the four Yellow Gold views.');
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
}) {
  const hasPresenter = !!presenter;
  const assetTypes = resolveAssetTypesForJob({ generateRoseGold, hasPresenter, confirmedType });
  return assetTypes.map((assetType) => {
    const override = overridesByAssetType?.[assetType];
    const sections = buildAssetPromptSections({
      assetType,
      confirmedType,
      template,
      presenter,
      creative: override,
      generateRoseGold,
      confirmedCustomerCategory,
    });
    return {
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
    });

  try {
    const referenceFile = await toFile(referenceBuffer, `reference.${extension}`, { type: mimetype });
    // Gents identity lock: Image 1 = presenter identity, Image 2 = jewellery
    // (see GENTS_IDENTITY_LOCK_NOTE, which tells the model this exact
    // ordering) — the reverse role order from the ordinary presenterReference
    // path below, and mutually exclusive with it (a Gents shot never also
    // carries a presenterReferenceBuffer — see aiStudioJob.js).
    let image;
    if (identityReferenceBuffer) {
      const identityFile = await toFile(identityReferenceBuffer, 'presenter-identity.png', { type: 'image/png' });
      image = [identityFile, referenceFile];
    } else if (presenterReferenceBuffer) {
      image = [referenceFile, await toFile(presenterReferenceBuffer, `presenter.jpeg`, { type: 'image/jpeg' })];
    } else {
      image = referenceFile;
    }

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
const RING_VALIDATION_COMMON =
  ' The background must be plain clean white — set validationStatus to "failed" for a coloured, gradient or textured background, for a rose-gold or white-gold ring (yellow gold only), or for any hand, finger or person.';
const RING_VALIDATION_CONTEXT = {
  RING_GOLD_HERO:
    ' This is the Ring HERO THREE-QUARTER VIEW — the ring stands upright at an approximately 40-45 degree three-quarter angle, showing the centre stone, the decorative top and the band, centred with balanced white space. Set validationStatus to "failed" if any part of the ring is cropped out of frame, or if this is a flat top-down view or a pure side profile instead of a three-quarter view.',
  RING_GOLD_FRONT:
    ' This is the Ring FRONT/TOP VIEW — the ring lies horizontally and the complete decorative top is seen from the front or a slightly elevated top angle, with the centre stone and the small stones clearly shown. Set validationStatus to "failed" if the ring stands upright at a three-quarter angle (that is the hero view), if the decorative section is incomplete, or if any part of the ring is cropped out of frame.',
  RING_GOLD_SIDE:
    ' This is the Ring SIDE-PROFILE VIEW — the ring stands upright and is seen from the side, showing the band profile, setting height, prongs and centre-stone mounting. Set validationStatus to "failed" if this looks like a three-quarter hero view or a front view rather than a genuine side profile, or if any part of the ring is cropped out of frame.',
  RING_GOLD_MACRO:
    ' This is the Ring MACRO DETAIL VIEW — a close-up of the main design (centre stone, prongs, small stones, metal finishing, setting). Part of the band extending outside the frame is EXPECTED and must not be flagged. Set validationStatus to "failed" only if an important stone or primary design detail is cropped out, or if the centre design is not the focal point.',
};

// Each Ring view is checked against its own angle rules — one vision call
// only sees its own image, but a hero that came out as a side view (or a
// side view that is just the hero rotated) fails its own checklist.
function ringValidationContextFor(assetType) {
  const context = RING_VALIDATION_CONTEXT[assetType];
  return context ? `${context}${RING_VALIDATION_COMMON}` : '';
}

// Necklace sets — the system prompt's rule (2) ("no additional jewellery")
// would otherwise flag a set's own matching earrings as an extra ornament.
function catalogueValidationContextFor(assetType) {
  if (!CATALOGUE_ASSET_TYPES.has(assetType)) return '';
  return ' This is a PRODUCT-ONLY catalogue image (no model). Set validationStatus to "failed" if any person, model, mannequin, bust, face, neck, ears, hands or other body part appears anywhere in the generated image.';
}

function necklaceValidationContextFor(confirmedType) {
  if (confirmedType !== 'NECKLACE') return '';
  return ' This is the Necklace category: if the original reference shows the necklace together with matching earrings (a necklace set), those earrings are part of the product and must NOT be flagged as additional jewellery. In that case set validationStatus to "failed" if the generated image is missing the necklace or the matching earrings, or — on a presenter shot — if the presenter is not wearing both (necklace on the neck, matching earrings on the ears). Also compare the earrings closely with the reference: set validationStatus to "failed" if their type, size or length differs — e.g. the reference shows small stud earrings but the generated image shows drop, dangle, chandelier or hoop earrings, or the earrings are visibly longer or larger than in the reference — and say so explicitly, e.g. "Failed: Earrings changed from studs to long drops." If the reference shows only a necklace, set validationStatus to "failed" if any earrings appear in the generated image.';
}

// A presenter shot showing a hand only (Ring's dedicated workflow) has no
// visible model demographic to check — every other presenter-eligible shot
// (PRESENTER_* and, for a non-Ring category, any future hand/body shot) does.
const NO_DEMOGRAPHIC_ASSET_TYPES = new Set([...RING_ASSET_TYPES, 'RING_ROSE_FRONT', 'RING_ROSE_SIDE']);

// Audience-specific validation criteria (spec's "VALIDATION" section) —
// appended alongside ringValidationContextFor, never replacing it, so a
// Ring + Gents/Kids hand shot is checked for BOTH the existing hand-only
// physical-placement rules AND the correct model demographic. WOMEN/UNISEX
// add nothing here, same as they add nothing to the generation prompt.
function audienceValidationContextFor(confirmedCustomerCategory, assetType) {
  if (NO_DEMOGRAPHIC_ASSET_TYPES.has(assetType)) return '';
  if (confirmedCustomerCategory === 'GENTS') {
    const isRingHand = assetType === 'RING_HAND_1' || assetType === 'RING_HAND_2';
    return ` The confirmed customer category is GENTS — verify the presenter${isRingHand ? "'s hand" : ''} is unambiguously that of an adult male (not a female or child), that the jewellery is worn in the correct location, that no unrelated jewellery is visible, that the product design matches the reference, and that product scale and placement are realistic. Set validationStatus to "failed" if the presenter reads as female or as a child.`;
  }
  if (confirmedCustomerCategory === 'KIDS') {
    const isRingHand = assetType === 'RING_HAND_1' || assetType === 'RING_HAND_2';
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
}) {
  if (!env.openaiVisionModel) {
    throw new AppError(503, 'AI validation is not configured');
  }
  const openai = getClient();
  const generatedBase64 = generatedBuffer.toString('base64');
  const referenceBase64 = referenceBuffer.toString('base64');

  let text = `Expected jewellery category: ${confirmedType}. Expected metal colour: ${metalColor}. Asset type: ${assetType}. The first image is the generated result; the second image is the original product reference.${ringValidationContextFor(assetType)}${necklaceValidationContextFor(confirmedType)}${catalogueValidationContextFor(assetType)}${audienceValidationContextFor(confirmedCustomerCategory, assetType)}`;

  const content = [
    { type: 'text', text },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${generatedBase64}`, detail: 'high' } },
    { type: 'image_url', image_url: { url: `data:${referenceMimetype};base64,${referenceBase64}`, detail: 'high' } },
  ];

  if (identityReferenceBuffer) {
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
