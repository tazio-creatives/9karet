import { useEffect } from 'react';
import type { SortOption } from '../../api/types';
import { SORT_OPTIONS } from './SortSelect';
import styles from './SortSheet.module.css';

interface SortSheetProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  onClose: () => void;
}

export function SortSheet({ value, onChange, onClose }: SortSheetProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Sort by" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <p className={styles.title}>Sort By</p>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.options} role="radiogroup" aria-label="Sort options">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={value === o.value}
              className={value === o.value ? styles.optionActive : styles.option}
              onClick={() => {
                onChange(o.value);
                onClose();
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
