import styles from './Toggle.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (_checked: boolean) => void;
  label: string;
  helperText?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, helperText, disabled }: ToggleProps) {
  return (
    <div className={styles.row}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={checked ? styles.trackOn : styles.track}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} />
      </button>
      <div className={styles.textCol}>
        <span className={styles.label}>{label}</span>
        {helperText && <span className={styles.helperText}>{helperText}</span>}
      </div>
    </div>
  );
}
