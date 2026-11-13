import { useEffect, useRef, useState } from 'react';
import styles from './SearchableSelect.module.css';

export interface SearchableSelectOption {
  id: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  selectedLabel?: string | null;
  onChange: (id: string, label: string) => void;
  onClear: () => void;
  loadOptions: (query: string) => Promise<SearchableSelectOption[]> | SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

// Generic combobox used wherever an admin needs to pick a category,
// collection, or product by name instead of hunting through a giant native
// <select> — loadOptions can either filter an already-fetched list
// client-side (categories/collections) or hit the search API per keystroke
// (products), the component doesn't care which.
export function SearchableSelect({
  value,
  selectedLabel,
  onChange,
  onClear,
  loadOptions,
  placeholder = 'Search…',
  disabled,
}: SearchableSelectProps) {
  const [query, setQuery] = useState(selectedLabel ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<SearchableSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  // Keep the visible text in sync with the selection when it changes from
  // outside (switching Redirect Type, or loading a saved item) without
  // clobbering what the admin is actively typing into the box.
  useEffect(() => {
    if (!isOpen) setQuery(selectedLabel ?? '');
  }, [selectedLabel, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const id = ++requestIdRef.current;
    setIsLoading(true);
    const timer = window.setTimeout(() => {
      Promise.resolve(loadOptions(query)).then((result) => {
        if (!cancelled && requestIdRef.current === id) {
          setOptions(result);
          setIsLoading(false);
        }
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isOpen]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery(selectedLabel ?? '');
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [selectedLabel]);

  function handleSelect(option: SearchableSelectOption) {
    onChange(option.id, option.label);
    setQuery(option.label);
    setIsOpen(false);
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
        />
        {value && (
          <button
            type="button"
            className={styles.clearButton}
            aria-label="Clear selection"
            onClick={() => {
              onClear();
              setQuery('');
            }}
          >
            ×
          </button>
        )}
      </div>
      {isOpen && (
        <div className={styles.menu}>
          {isLoading ? (
            <p className={styles.menuMessage}>Searching…</p>
          ) : options.length === 0 ? (
            <p className={styles.menuMessage}>No matches.</p>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${styles.option} ${option.id === value ? styles.optionActive : ''}`}
                onClick={() => handleSelect(option)}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
