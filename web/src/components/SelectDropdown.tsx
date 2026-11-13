import { useEffect, useRef, useState } from 'react';
import styles from './SelectDropdown.module.css';

export interface SelectDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectDropdownProps {
  id?: string;
  value: string;
  placeholder: string;
  options: SelectDropdownOption[];
  onChange: (_value: string) => void;
  className?: string;
}

// A native <select>'s popup is positioned by the OS/browser, not by our CSS —
// Android Chrome is known to miscalculate that position when a
// `position: sticky` ancestor (our header) is on screen, landing the popup
// nowhere near the field. Rendering our own panel sidesteps that entirely.
export function SelectDropdown({ id, value, placeholder, options, onChange, className }: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`${styles.wrap} ${className ?? ''}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={styles.chevron}
          style={open ? { transform: 'rotate(180deg)' } : undefined}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className={styles.panel} role="listbox">
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                disabled={opt.disabled}
                className={opt.value === value ? styles.optionActive : styles.option}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
