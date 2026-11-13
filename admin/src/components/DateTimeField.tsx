import sharedStyles from '../styles/shared.module.css';

interface DateTimeFieldProps {
  label: string;
  value: string | null;
  onChange: (isoOrNull: string | null) => void;
  disabled?: boolean;
  hint?: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// <input type="datetime-local"> works in the viewer's LOCAL time and has no
// timezone of its own — the codebase has no prior usage of it (coupons use
// date-only <input type="date">), so this wrapper owns the local<->ISO
// conversion in one place rather than repeating it in every rule form.
function isoToLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputValueToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function DateTimeField({ label, value, onChange, disabled, hint }: DateTimeFieldProps) {
  return (
    <label className={sharedStyles.field}>
      {label}
      <input
        type="datetime-local"
        value={isoToLocalInputValue(value)}
        onChange={(e) => onChange(localInputValueToIso(e.target.value))}
        disabled={disabled}
      />
      {hint && <span style={{ fontWeight: 400, fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)' }}>{hint}</span>}
    </label>
  );
}
