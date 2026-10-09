import { useState } from 'react';
import type { ProductSize } from '../../api/types';
import { SizeGuide, type SizeGuideType } from './SizeGuide';
import styles from './SizeSelector.module.css';

interface SizeSelectorProps {
  sizes: ProductSize[];
  selectedSizeId: string | null;
  onSelect: (_sizeId: string) => void;
  // Overrides the "Size" wording (e.g. "Length" for a chain/necklace) — a
  // product using this axis for something other than a ring size sets this
  // via the admin form. Defaults to "Size", today's behavior.
  label?: string;
  // Which size guide fits this product (from its category) — rings get the
  // Indian ring chart, bangles the anna chart, anything else no guide
  // rather than a wrong one.
  guideType?: SizeGuideType | null;
}

export function SizeSelector({ sizes, selectedSizeId, onSelect, label = 'Size', guideType = null }: SizeSelectorProps) {
  const [showGuide, setShowGuide] = useState(false);

  if (sizes.length === 0) return null;

  const selectedSize = sizes.find((s) => s.id === selectedSizeId) ?? null;

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.label}>Select {label}</span>
        {guideType && (
          <button type="button" className={styles.guideLink} onClick={() => setShowGuide(true)}>
            Size Guide
          </button>
        )}
      </div>

      <div className={styles.options}>
        {sizes.map((size) => {
          const active = size.id === selectedSizeId;
          return (
            <button
              key={size.id}
              type="button"
              className={active ? styles.sizeActive : styles.size}
              aria-pressed={active}
              onClick={() => onSelect(size.id)}
            >
              {size.label}
            </button>
          );
        })}
      </div>

      {selectedSize && (
        <p className={selectedSize.availableStock > 0 ? styles.stockIndicator : styles.stockIndicatorMuted}>
          <span className={styles.stockDot} aria-hidden="true" />
          {selectedSize.availableStock > 0 ? 'In Stock' : 'Make to Order'}
        </p>
      )}

      {guideType && showGuide && (
        <SizeGuide type={guideType} sizeLabels={sizes.map((sz) => sz.label)} onClose={() => setShowGuide(false)} />
      )}
    </div>
  );
}
