import type { ProductSizeMeasurements } from '../../api/types';

// Specification rows for the Product Size Image measurements on the PDP
// (rendered by AttributesList). Pure — no React — so it can be tested
// directly.

// Compact "10 × 8 × 12 mm"-style summary of every entered numeric
// measurement, in the order the admin's Manual Measurements form saved them
// — deliberately doesn't re-derive per-category field labels here (that
// config only exists on the backend/admin side); this is plain accessible
// text, not a substitute for reading the image itself, but doesn't need
// per-field labels to be useful (plan: "Do not require customers to read
// measurements only from the image").
function formatDimensions(
  measurements: Record<string, number | string>,
  unit: string,
): string | null {
  const numericValues = Object.values(measurements).filter(
    (v): v is number => typeof v === 'number',
  );
  if (numericValues.length === 0) return null;
  return `${numericValues.join(' × ')} ${unit}`;
}

// Pendant records saved with an overall height (bail/loop included) keep it
// only for scaling the size image. The headline dimensions show what the
// loop choice says is measured: width × overall height when the loop is
// included, width × body height when it is excluded — the overall height is
// never mixed into a string that says the loop is excluded.
function pendantRows(sm: ProductSizeMeasurements): Array<[string, string]> {
  const m = sm.measurements;
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
  const width = num(m.pendantBodyWidth);
  const overall = num(m.pendantOverallHeight);
  const body = num(m.pendantBodyHeight);
  const loopExcluded = sm.excludedParts.includes('loop');
  const loopIncluded = sm.includedParts.includes('loop');

  const rows: Array<[string, string]> = [];
  const values = [width, loopExcluded ? body : overall].filter((v): v is number => v != null);
  if (values.length > 0) rows.push(['Product Dimensions', `${values.join(' × ')} ${sm.unit}`]);
  if (loopExcluded) {
    rows.push(['Measurement Note', 'Measurement excludes the loop.']);
    if (overall != null) rows.push(['Overall Height (including loop)', `${overall} ${sm.unit}`]);
  } else if (loopIncluded) {
    rows.push(['Measurement Note', 'Measurement includes the loop.']);
  }
  if (sm.note) rows.push(['Note', sm.note]);
  return rows;
}

export function sizeMeasurementRows(sm: ProductSizeMeasurements): Array<[string, string]> {
  if (sm.jewelleryType === 'PENDANT' && typeof sm.measurements.pendantOverallHeight === 'number') {
    return pendantRows(sm);
  }
  // Every other category, and Pendant records saved before the overall
  // height existed — unchanged.
  const rows: Array<[string, string]> = [];
  const dimensionText = formatDimensions(sm.measurements, sm.unit);
  if (dimensionText) rows.push(['Product Dimensions', dimensionText]);
  if (sm.excludedParts.length > 0) {
    rows.push(['Measurement Note', `Measurement excludes the ${sm.excludedParts.join(', ')}.`]);
  } else if (sm.includedParts.length > 0) {
    rows.push(['Measurement Note', `Measurement includes the ${sm.includedParts.join(', ')}.`]);
  }
  if (sm.note) rows.push(['Note', sm.note]);
  return rows;
}
