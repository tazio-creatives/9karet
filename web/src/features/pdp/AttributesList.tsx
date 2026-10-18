import type { ProductDetail } from '../../api/types';
import styles from './AttributesList.module.css';

// Weight columns are NUMERIC(10,3) in the DB — admin enters up to 3 decimal
// places (e.g. 0.580), but a plain template-literal interpolation silently
// drops trailing zeros (JS's Number(0.580) === 0.58), so a weight the admin
// entered with 3 decimals could render with only 1 or 2. Always show all 3.
function formatWeight(grams: number): string {
  return grams.toFixed(3);
}

// Compact "10 × 8 × 12 mm"-style summary of every entered numeric
// measurement, in the order the admin's Manual Measurements form saved them
// — deliberately doesn't re-derive per-category field labels here (that
// config only exists on the backend/admin side); this is plain accessible
// text, not a substitute for reading the image itself, but doesn't need
// per-field labels to be useful (plan: "Do not require customers to read
// measurements only from the image").
function formatDimensions(measurements: Record<string, number | string>, unit: string): string | null {
  const numericValues = Object.values(measurements).filter((v): v is number => typeof v === 'number');
  if (numericValues.length === 0) return null;
  return `${numericValues.join(' × ')} ${unit}`;
}

interface AttributesListProps {
  product: ProductDetail;
  // Live-selection overrides — a variant picked via Gold Colour/Size can
  // genuinely differ from the product's own base configuration (a bigger
  // size weighs more, say), so this panel must reflect what's actually
  // selected/priced, not always the product's admin-set defaults. Each is
  // optional and falls back to the matching static `product` field when not
  // provided (e.g. the axis isn't configured, or nothing's selected yet).
  livePurity?: string | null;
  liveGoldColor?: string | null;
  liveGoldWeightGrams?: number | null;
  liveNetWeightGrams?: number | null;
  liveGrossWeightGrams?: number | null;
}

export function AttributesList({
  product,
  livePurity,
  liveGoldColor,
  liveGoldWeightGrams,
  liveNetWeightGrams,
  liveGrossWeightGrams,
}: AttributesListProps) {
  // Fixed trust line shown on every product, regardless of what (if
  // anything) is stored on product.certification — applies uniformly to
  // existing and future products alike, not sourced from per-product data.
  const rows: [string, string][] = [
    ['SKU', product.sku],
    ['Certification', 'BIS Hallmarked'],
  ];

  const purity = livePurity ?? product.purity;
  const goldColor = liveGoldColor ?? product.goldColor;
  const goldWeightGrams = liveGoldWeightGrams ?? product.goldWeightGrams;
  const netWeightGrams = liveNetWeightGrams ?? product.netWeightGrams;
  const grossWeightGrams = liveGrossWeightGrams ?? product.grossWeightGrams;

  const goldColorLabel = goldColor ? goldColor.charAt(0) + goldColor.slice(1).toLowerCase() : '';
  rows.push(['Metal', [purity, goldColorLabel, 'Gold'].filter(Boolean).join(' ')]);
  if (purity) rows.push(['Purity', purity]);

  if (goldWeightGrams != null) rows.push(['Gold Weight', `${formatWeight(goldWeightGrams)} g`]);
  if (netWeightGrams != null) rows.push(['Net Weight', `${formatWeight(netWeightGrams)} g`]);
  if (grossWeightGrams != null) rows.push(['Gross Weight', `${formatWeight(grossWeightGrams)} g`]);
  // One row per stone line — e.g. "Ruby: 1 stone · 0.300 ct".
  for (const stone of product.stones) {
    rows.push([
      stone.stoneTypeName,
      `${stone.count} ${stone.count === 1 ? 'stone' : 'stones'} · ${formatWeight(stone.weightCarats)} ct`,
    ]);
  }
  if (product.stones.length > 1 && product.stoneWeightCarats != null) {
    rows.push(['Total Stone Weight', `${formatWeight(product.stoneWeightCarats)} ct`]);
  }

  const sizeMeasurements = product.productSizeMeasurements;
  if (sizeMeasurements) {
    const dimensionText = formatDimensions(sizeMeasurements.measurements, sizeMeasurements.unit);
    if (dimensionText) rows.push(['Product Dimensions', dimensionText]);
    if (sizeMeasurements.excludedParts.length > 0) {
      rows.push(['Measurement Note', `Measurement excludes the ${sizeMeasurements.excludedParts.join(', ')}.`]);
    } else if (sizeMeasurements.includedParts.length > 0) {
      rows.push(['Measurement Note', `Measurement includes the ${sizeMeasurements.includedParts.join(', ')}.`]);
    }
    if (sizeMeasurements.note) rows.push(['Note', sizeMeasurements.note]);
  }

  return (
    <dl className={styles.list}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.row}>
          <dt className={styles.term}>{label}</dt>
          <dd className={styles.value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
