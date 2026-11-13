import styles from './ProductVariations.module.css';

interface ChipOption {
  key: string;
  label: string;
  selected: boolean;
}

interface OptionChipRowProps {
  label: string;
  options: ChipOption[];
  onToggle: (key: string) => void;
  emptyNote?: string;
}

// One compact row per attribute (e.g. Gold Colour) —
// a plain toggle list of what this product offers on that axis. No
// combination logic lives here; it's purely "which values are checked."
export function OptionChipRow({ label, options, onToggle, emptyNote }: OptionChipRowProps) {
  return (
    <div className={styles.attrRow}>
      <span className={styles.attrLabel}>{label}</span>
      {options.length === 0 && emptyNote ? (
        <p className={styles.emptyNote}>{emptyNote}</p>
      ) : (
        <div className={styles.chipRow}>
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={opt.selected ? styles.chipSelected : styles.chip}
              onClick={() => onToggle(opt.key)}
              aria-pressed={opt.selected}
            >
              {opt.selected && <span className={styles.chipCheck}>✓</span>}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
