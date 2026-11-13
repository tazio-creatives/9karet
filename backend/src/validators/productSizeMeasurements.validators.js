import { AppError } from '../utils/AppError.js';

// Single source of truth for which fields the Manual Measurements form
// shows per confirmed jewellery type (plan: "Show only fields relevant to
// the confirmed category") — mirrored in the admin TS UI
// (admin/src/features/aiStudio/measurementFields.ts) since the form itself
// needs the same config to render inputs; kept here as the source backend
// validation is checked against.
export const CATEGORY_MEASUREMENT_FIELDS = {
  RING: [
    { key: 'ringTopWidth', label: 'Ring-top width', type: 'number' },
    { key: 'ringTopHeight', label: 'Ring-top height', type: 'number' },
    { key: 'bandWidth', label: 'Band width', type: 'number' },
    { key: 'innerDiameter', label: 'Inner diameter', type: 'number' },
    { key: 'ringSize', label: 'Ring size', type: 'text' },
  ],
  // Overall height (bail/loop included) is what the photographed pendant is
  // scaled to; body height is only used — and required — when the loop is
  // excluded, to place the exact body/loop boundary (see INCLUSION_RULES).
  // Records saved before pendantOverallHeight existed are "legacy": their
  // pendantBodyHeight keeps its original meaning and rendering.
  PENDANT: [
    { key: 'pendantBodyWidth', label: 'Pendant width', type: 'number' },
    { key: 'pendantOverallHeight', label: 'Overall pendant height (loop included)', type: 'number' },
    { key: 'pendantBodyHeight', label: 'Pendant body height (loop excluded)', type: 'number' },
  ],
  EARRINGS: [
    { key: 'earringWidth', label: 'Earring width', type: 'number' },
    { key: 'earringHeight', label: 'Earring height', type: 'number' },
    { key: 'dropLength', label: 'Drop length', type: 'number' },
  ],
  BANGLE: [
    { key: 'innerDiameter', label: 'Inner diameter', type: 'number' },
    { key: 'outerDiameter', label: 'Outer diameter', type: 'number' },
    { key: 'bandWidth', label: 'Band width', type: 'number' },
    { key: 'thickness', label: 'Product thickness', type: 'number' },
  ],
  BRACELET: [
    { key: 'braceletLength', label: 'Bracelet length', type: 'number' },
    { key: 'braceletWidth', label: 'Bracelet width', type: 'number' },
    { key: 'thickness', label: 'Product thickness', type: 'number' },
  ],
  NECKLACE: [
    { key: 'totalLength', label: 'Total length', type: 'number' },
    { key: 'pendantWidth', label: 'Pendant width', type: 'number' },
    { key: 'pendantHeight', label: 'Pendant height', type: 'number' },
  ],
};
CATEGORY_MEASUREMENT_FIELDS.CHAIN = CATEGORY_MEASUREMENT_FIELDS.NECKLACE;

// Fallback for any jewellery type the spec didn't give an explicit field
// list for (Bracelet/Anklet/Nose Pin/Mangalsutra/Brooch/Other etc use this
// too where not already covered above) — the spec's own "Common fields"
// vocabulary.
export const GENERIC_MEASUREMENT_FIELDS = [
  { key: 'productWidth', label: 'Product width', type: 'number' },
  { key: 'productHeight', label: 'Product height', type: 'number' },
  { key: 'productLength', label: 'Product length', type: 'number' },
  { key: 'productDiameter', label: 'Product diameter', type: 'number' },
  { key: 'innerDiameter', label: 'Inner diameter', type: 'number' },
  { key: 'bandWidth', label: 'Band width', type: 'number' },
  { key: 'thickness', label: 'Product thickness', type: 'number' },
];

export function fieldsForCategory(jewelleryType) {
  return CATEGORY_MEASUREMENT_FIELDS[jewelleryType] ?? GENERIC_MEASUREMENT_FIELDS;
}

// Which saved fields represent the piece's overall photographed width/height
// — used to derive the ruler's px-per-unit scale (productSizeImageService.js
// composeMeasurementImage). Some categories only have one true overall
// dimension (a Bangle/Bracelet/chain's "shape" isn't meaningfully width x
// height) — heightKey is null there. The declared values are trusted as
// entered — there's no cross-check against the photo's detected proportions
// (explicit product decision: an admin's own physical measurement of the
// piece always wins, never rejected over a detected-vs-declared mismatch).
const PRIMARY_DIMENSIONS = {
  RING: { widthKey: 'ringTopWidth', heightKey: 'ringTopHeight' },
  // heightKey is the whole visible piece (loop included) — it's what's
  // actually in the photo, so it's what the ruler scale must be built from.
  // There's deliberately no separate
  // "total height" field any more (see INCLUSION_RULES.PENDANT below).
  PENDANT: { widthKey: 'pendantBodyWidth', heightKey: 'pendantBodyHeight' },
  EARRINGS: { widthKey: 'earringWidth', heightKey: 'dropLength' },
  BANGLE: { widthKey: 'outerDiameter', heightKey: null },
  BRACELET: { widthKey: 'braceletLength', heightKey: null },
  NECKLACE: { widthKey: 'totalLength', heightKey: null },
  CHAIN: { widthKey: 'totalLength', heightKey: null },
};

// A Pendant record saved before the overall-height field existed — it is
// never reinterpreted: it keeps scaling from pendantBodyHeight exactly as it
// was generated, and must gain an overall height before it can regenerate.
export function isLegacyPendantMeasurements(jewelleryType, measurements) {
  return jewelleryType === 'PENDANT' && typeof measurements?.pendantOverallHeight !== 'number';
}

export function primaryDimensionsFor(jewelleryType, measurements) {
  let config = PRIMARY_DIMENSIONS[jewelleryType] ?? { widthKey: 'productWidth', heightKey: 'productHeight' };
  // New Pendant records scale the whole photographed pendant (bail included)
  // to its real overall height.
  if (jewelleryType === 'PENDANT' && !isLegacyPendantMeasurements(jewelleryType, measurements)) {
    config = { widthKey: 'pendantBodyWidth', heightKey: 'pendantOverallHeight' };
  }
  const widthValue = measurements[config.widthKey];
  const heightValue = config.heightKey ? measurements[config.heightKey] : null;
  return {
    widthValue: typeof widthValue === 'number' ? widthValue : null,
    heightValue: typeof heightValue === 'number' ? heightValue : null,
  };
}

// Category -> which "part" can be included/excluded, and (only for Pendant,
// where the spec gives both a part-only and a whole-piece field) the pair of
// saved measurement keys the proportional exclusion-boundary math in
// productSizeImageService.js divides against each other. Categories without
// a partHeightKey/wholeHeightKey still require the included/excluded choice
// (plan: "require an inclusion/exclusion selection when the product contains
// a loop, hook or clasp") but the rendered image shows only the
// included/excluded text note for them, not a separate dashed boundary line
// — there is no admin-entered part-vs-whole pair to draw one from.
export const INCLUSION_RULES = {
  // No partHeightKey/wholeHeightKey here any more — there's only one height
  // field now (see PRIMARY_DIMENSIONS.PENDANT above), so "Loop excluded"
  // is informational only, same as every other category below: it labels
  // the piece in the rendered image, but there's no separate body-only
  // number to compute a proportional boundary line from.
  // Pendant has a real part/whole pair: body height (loop excluded) and
  // overall height (loop included), both physically measured — the body/loop
  // boundary is drawn at their exact ratio, never estimated.
  PENDANT: { part: 'loop', label: 'Loop', partHeightKey: 'pendantBodyHeight', wholeHeightKey: 'pendantOverallHeight' },
  NECKLACE: { part: 'loop', label: 'Loop' },
  CHAIN: { part: 'loop', label: 'Loop' },
  EARRINGS: { part: 'hook', label: 'Hook' },
  BRACELET: { part: 'clasp', label: 'Clasp' },
};

// "At most two decimal places", tolerant of binary floating point: 20.4 * 100
// is 2039.9999999999998, so an exact `Math.round(v * 100) === v * 100` check
// wrongly rejected valid values like 20.4, 1.1 and 0.29. A genuine third
// decimal (20.401 → 2040.1) is still far outside the tolerance.
const DECIMAL_TOLERANCE = 1e-6;

export function hasAtMostTwoDecimals(value) {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < DECIMAL_TOLERANCE;
}

function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && hasAtMostTwoDecimals(value);
}

export const PENDANT_MESSAGES = {
  overallRequired:
    'Required overall height is missing — enter the Overall pendant height (loop included) to generate the size image.',
  bodyRequired: 'Loop excluded needs the Pendant body height (loop excluded) as well as the overall height.',
  bodyNotSmaller: 'Body height must be smaller than overall height.',
  bodyOnlyWhenExcluded:
    'Pendant body height is only used when the loop is excluded — choose "Loop excluded" or clear the body height.',
};

// Pendant part/whole rules. Saving stays lenient (a half-filled form can be
// saved), but generation needs every value the ruler will use.
function validatePendantHeights({ measurements, isIncluded, isExcluded, forGeneration }) {
  const { partHeightKey, wholeHeightKey } = INCLUSION_RULES.PENDANT;
  const body = measurements[partHeightKey];
  const overall = measurements[wholeHeightKey];
  const hasBody = isValidNumber(body);
  const hasOverall = isValidNumber(overall);
  if (hasBody && hasOverall && body >= overall) throw new AppError(400, PENDANT_MESSAGES.bodyNotSmaller);
  if (!forGeneration) return;
  if (!hasOverall) throw new AppError(400, PENDANT_MESSAGES.overallRequired);
  if (isExcluded && !hasBody) throw new AppError(400, PENDANT_MESSAGES.bodyRequired);
  if (isIncluded && hasBody) throw new AppError(400, PENDANT_MESSAGES.bodyOnlyWhenExcluded);
}

// Runs on both PUT (save) and POST (save-then-generate) — save-without-
// generating still needs to reject garbage data, just without requiring
// every field an eventual generation would need (`forGeneration`).
export function validateMeasurementsInput(
  { jewelleryType, unit, measurements, includedParts, excludedParts },
  { forGeneration = false } = {},
) {
  if (unit !== 'mm' && unit !== 'cm') {
    throw new AppError(400, 'Select the measurement unit.');
  }

  const fields = fieldsForCategory(jewelleryType);
  const numberFields = fields.filter((f) => f.type === 'number');
  const providedNumberEntries = numberFields.filter((f) => measurements[f.key] != null && measurements[f.key] !== '');

  if (providedNumberEntries.length === 0) {
    throw new AppError(400, 'Enter at least one measurement.');
  }

  for (const field of providedNumberEntries) {
    const value = measurements[field.key];
    if (!isValidNumber(value)) {
      throw new AppError(400, `Enter a valid ${field.label.toLowerCase()}.`);
    }
  }

  const inclusionRule = INCLUSION_RULES[jewelleryType];
  if (inclusionRule) {
    const isIncluded = (includedParts ?? []).includes(inclusionRule.part);
    const isExcluded = (excludedParts ?? []).includes(inclusionRule.part);
    if (!isIncluded && !isExcluded) {
      throw new AppError(400, `Choose whether the ${inclusionRule.label.toLowerCase()} is included.`);
    }
    if (isIncluded && isExcluded) {
      throw new AppError(400, `The ${inclusionRule.label.toLowerCase()} cannot be both included and excluded.`);
    }
    if (jewelleryType === 'PENDANT') {
      validatePendantHeights({ measurements, isIncluded, isExcluded, forGeneration });
    }
  }
}
