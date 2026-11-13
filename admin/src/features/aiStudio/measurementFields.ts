import type { JewelleryType } from '../../api/aiStudio';

// TS mirror of backend/src/validators/productSizeMeasurements.validators.js
// — same field keys/labels/categories, kept in lockstep since both the form
// here and the backend's save/generate validation need the identical
// per-category shape (same convention as generationRules.ts mirroring
// aiStudioService.js elsewhere in this file).
export interface MeasurementField {
  key: string;
  label: string;
  type: 'number' | 'text';
}

const CATEGORY_MEASUREMENT_FIELDS: Partial<Record<JewelleryType, MeasurementField[]>> = {
  RING: [
    { key: 'ringTopWidth', label: 'Ring-top width', type: 'number' },
    { key: 'ringTopHeight', label: 'Ring-top height', type: 'number' },
    { key: 'bandWidth', label: 'Band width', type: 'number' },
    { key: 'innerDiameter', label: 'Inner diameter', type: 'number' },
    { key: 'ringSize', label: 'Ring size', type: 'text' },
  ],
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

const GENERIC_MEASUREMENT_FIELDS: MeasurementField[] = [
  { key: 'productWidth', label: 'Product width', type: 'number' },
  { key: 'productHeight', label: 'Product height', type: 'number' },
  { key: 'productLength', label: 'Product length', type: 'number' },
  { key: 'productDiameter', label: 'Product diameter', type: 'number' },
  { key: 'innerDiameter', label: 'Inner diameter', type: 'number' },
  { key: 'bandWidth', label: 'Band width', type: 'number' },
  { key: 'thickness', label: 'Product thickness', type: 'number' },
];

export function fieldsForCategory(jewelleryType: JewelleryType | ''): MeasurementField[] {
  if (!jewelleryType) return GENERIC_MEASUREMENT_FIELDS;
  return CATEGORY_MEASUREMENT_FIELDS[jewelleryType] ?? GENERIC_MEASUREMENT_FIELDS;
}

// The fields the form shows. Pendant depends on the loop choice: the body
// height is only asked for (and only sent) when the loop is excluded. Every
// other category shows its full list, as before.
export function fieldsForMeasurementForm(
  jewelleryType: JewelleryType | '',
  inclusionChoice: 'included' | 'excluded' | '',
): MeasurementField[] {
  const fields = fieldsForCategory(jewelleryType);
  if (jewelleryType !== 'PENDANT' || inclusionChoice === 'excluded') return fields;
  return fields.filter((f) => f.key !== 'pendantBodyHeight');
}

// Mirrors hasAtMostTwoDecimals in the backend validator (which stays the
// authority): tolerant of binary floating point, so 20.4 / 1.1 / 0.29 are
// accepted and a real third decimal (20.401) is rejected.
const DECIMAL_TOLERANCE = 1e-6;

export function hasAtMostTwoDecimals(value: number): boolean {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < DECIMAL_TOLERANCE;
}

// Mirrors PENDANT_MESSAGES in the backend validator.
export const PENDANT_MESSAGES = {
  overallRequired:
    'Required overall height is missing — enter the Overall pendant height (loop included) to generate the size image.',
  bodyRequired: 'Loop excluded needs the Pendant body height (loop excluded) as well as the overall height.',
  bodyNotSmaller: 'Body height must be smaller than overall height.',
};

export interface InclusionRule {
  part: string;
  label: string;
  partHeightKey?: string;
  wholeHeightKey?: string;
}

const INCLUSION_RULES: Partial<Record<JewelleryType, InclusionRule>> = {
  PENDANT: { part: 'loop', label: 'Loop', partHeightKey: 'pendantBodyHeight', wholeHeightKey: 'pendantOverallHeight' },
  NECKLACE: { part: 'loop', label: 'Loop' },
  CHAIN: { part: 'loop', label: 'Loop' },
  EARRINGS: { part: 'hook', label: 'Hook' },
  BRACELET: { part: 'clasp', label: 'Clasp' },
};

export function inclusionRuleFor(jewelleryType: JewelleryType | ''): InclusionRule | null {
  if (!jewelleryType) return null;
  return INCLUSION_RULES[jewelleryType] ?? null;
}
