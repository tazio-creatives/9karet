import { useEffect, useState } from 'react';
import { formatPrice } from '../../utils/formatPrice';
import styles from './PriceRangeSlider.module.css';

const BOUNDS_MIN = 0;
const BOUNDS_MAX = 500000;

interface PriceRangeSliderProps {
  valueMin?: number;
  valueMax?: number;
  onCommit: (priceMin: number | undefined, priceMax: number | undefined) => void;
}

// Standard two-overlapping-<input type="range"> dual-thumb slider — each
// input is transparent and only its thumb is interactive (pointer-events
// toggled to whichever thumb sits closer to a given track position via the
// stacking order below), a well-known accessible technique that avoids
// hand-rolling pointer/drag math. Commits on release (mouseup/touchend),
// not on every drag tick, to avoid spamming the products query.
export function PriceRangeSlider({ valueMin, valueMax, onCommit }: PriceRangeSliderProps) {
  const [min, setMin] = useState(valueMin ?? BOUNDS_MIN);
  const [max, setMax] = useState(valueMax ?? BOUNDS_MAX);

  useEffect(() => {
    setMin(valueMin ?? BOUNDS_MIN);
    setMax(valueMax ?? BOUNDS_MAX);
  }, [valueMin, valueMax]);

  function commit(nextMin: number, nextMax: number) {
    onCommit(
      nextMin > BOUNDS_MIN ? nextMin : undefined,
      nextMax < BOUNDS_MAX ? nextMax : undefined,
    );
  }

  const minPercent = ((min - BOUNDS_MIN) / (BOUNDS_MAX - BOUNDS_MIN)) * 100;
  const maxPercent = ((max - BOUNDS_MIN) / (BOUNDS_MAX - BOUNDS_MIN)) * 100;

  return (
    <div className={styles.wrapper}>
      <div className={styles.track}>
        <div className={styles.trackFill} style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }} />
        <input
          type="range"
          className={styles.range}
          min={BOUNDS_MIN}
          max={BOUNDS_MAX}
          step={1000}
          value={min}
          onChange={(e) => setMin(Math.min(Number(e.target.value), max))}
          onMouseUp={() => commit(min, max)}
          onTouchEnd={() => commit(min, max)}
          style={{ zIndex: min > BOUNDS_MAX - 20000 ? 4 : 3 }}
          aria-label="Minimum price"
        />
        <input
          type="range"
          className={styles.range}
          min={BOUNDS_MIN}
          max={BOUNDS_MAX}
          step={1000}
          value={max}
          onChange={(e) => setMax(Math.max(Number(e.target.value), min))}
          onMouseUp={() => commit(min, max)}
          onTouchEnd={() => commit(min, max)}
          aria-label="Maximum price"
        />
      </div>
      <div className={styles.labels}>
        <span>{formatPrice(min)}</span>
        <span>{max >= BOUNDS_MAX ? `${formatPrice(BOUNDS_MAX)}+` : formatPrice(max)}</span>
      </div>
    </div>
  );
}
