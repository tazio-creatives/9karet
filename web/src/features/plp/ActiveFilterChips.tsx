import type { FilterValues } from './FilterSidebar';
import { formatPrice } from '../../utils/formatPrice';
import { COLOR_SWATCH } from '../pdp/goldColorSwatch';
import styles from './ActiveFilterChips.module.css';

interface ActiveFilterChipsProps {
  values: FilterValues;
  onChange: (patch: FilterValues) => void;
}

// Read/remove view over the same 5 filter values FilterSidebar already
// consumes — no new filter dimensions, purely a summary of what's active.
export function ActiveFilterChips({ values, onChange }: ActiveFilterChipsProps) {
  const chips: { key: string; label: string; clear: FilterValues }[] = [];

  if (values.goldColor) {
    chips.push({ key: 'goldColor', label: COLOR_SWATCH[values.goldColor].label, clear: { goldColor: undefined } });
  }
  if (values.purity) {
    chips.push({ key: 'purity', label: values.purity, clear: { purity: undefined } });
  }
  if (values.priceMin != null || values.priceMax != null) {
    const label =
      values.priceMin != null && values.priceMax != null
        ? `${formatPrice(values.priceMin)} - ${formatPrice(values.priceMax)}`
        : values.priceMin != null
          ? `Above ${formatPrice(values.priceMin)}`
          : `Under ${formatPrice(values.priceMax as number)}`;
    chips.push({ key: 'price', label, clear: { priceMin: undefined, priceMax: undefined } });
  }

  if (chips.length === 0) return null;

  return (
    <div className={styles.row}>
      {chips.map((chip) => (
        <button key={chip.key} type="button" className={styles.chip} onClick={() => onChange(chip.clear)}>
          {chip.label}
          <span className={styles.remove} aria-hidden="true">
            ×
          </span>
        </button>
      ))}
    </div>
  );
}
