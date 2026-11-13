import type { GoldColor } from '../../api/types';
import { COLOR_SWATCH } from './goldColorSwatch';
import styles from './ColorSelector.module.css';

interface ColorSelectorProps {
  colors: GoldColor[];
  selectedColor: GoldColor | null;
  onSelect: (_color: GoldColor) => void;
  // Real per-product availability check (from useVariantSelection, driven
  // by that product's actual variants) — this component stays generic/
  // product-agnostic itself. An unavailable colour is disabled rather than
  // hidden, so the shopper can see the option exists and why it's blocked.
  isColorAvailable: (color: GoldColor) => boolean;
}

export function ColorSelector({ colors, selectedColor, onSelect, isColorAvailable }: ColorSelectorProps) {
  if (colors.length === 0) return null;

  const unavailableColor = colors.find((color) => !isColorAvailable(color));

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Gold Colour</span>
      <div className={styles.row}>
        {colors.map((color) => {
          const swatch = COLOR_SWATCH[color];
          const active = selectedColor === color;
          const available = isColorAvailable(color);
          return (
            <button
              key={color}
              type="button"
              className={active ? styles.cardActive : available ? styles.card : styles.cardDisabled}
              aria-pressed={active}
              aria-disabled={!available}
              disabled={!available}
              onClick={() => available && onSelect(color)}
            >
              <span className={styles.swatch} style={{ background: swatch.hex }} aria-hidden="true" />
              {swatch.label}
            </button>
          );
        })}
      </div>
      {unavailableColor && (
        <p className={styles.unavailableNote}>
          {COLOR_SWATCH[unavailableColor].label} isn&apos;t currently available for this product.
        </p>
      )}
    </div>
  );
}
