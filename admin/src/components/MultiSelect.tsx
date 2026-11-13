import { useEffect, useRef, useState } from 'react';
import styles from './MultiSelect.module.css';

export interface MultiSelectOption {
  id: string;
  label: string;
}

interface MultiSelectProps {
  values: string[];
  /** id -> label for every currently-selected value, so a chip can render
   *  even for an id that isn't in the current search results. */
  selectedLabels: Record<string, string>;
  onChange: (values: string[], selectedLabels: Record<string, string>) => void;
  loadOptions: (query: string) => Promise<MultiSelectOption[]> | MultiSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Shows "Select all" for whatever's currently loaded/visible — not
   *  necessarily every possible option, since loadOptions may page/filter. */
  allowSelectAll?: boolean;
}

// Forked from SearchableSelect.tsx (same 200ms-debounced loadOptions
// contract, same race-guard via requestIdRef) — the difference is the menu
// stays open across picks and selections render as removable chips instead
// of replacing the input's text.
export function MultiSelect({
  values,
  selectedLabels,
  onChange,
  loadOptions,
  placeholder = 'Search…',
  disabled,
  allowSelectAll = false,
}: MultiSelectProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<MultiSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

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
        setQuery('');
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function toggle(option: MultiSelectOption) {
    const isSelected = values.includes(option.id);
    const nextValues = isSelected ? values.filter((v) => v !== option.id) : [...values, option.id];
    const nextLabels = isSelected
      ? Object.fromEntries(Object.entries(selectedLabels).filter(([id]) => id !== option.id))
      : { ...selectedLabels, [option.id]: option.label };
    onChange(nextValues, nextLabels);
  }

  function remove(id: string) {
    const nextLabels = Object.fromEntries(Object.entries(selectedLabels).filter(([existingId]) => existingId !== id));
    onChange(
      values.filter((v) => v !== id),
      nextLabels,
    );
  }

  function selectAllVisible() {
    const nextValues = new Set(values);
    const nextLabels = { ...selectedLabels };
    for (const option of options) {
      nextValues.add(option.id);
      nextLabels[option.id] = option.label;
    }
    onChange([...nextValues], nextLabels);
  }

  function clearAll() {
    onChange([], {});
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {values.length > 0 && (
        <div className={styles.chips}>
          {values.map((id) => (
            <span key={id} className={styles.chip}>
              {selectedLabels[id] ?? id}
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`Remove ${selectedLabels[id] ?? id}`}
                onClick={() => remove(id)}
                disabled={disabled}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
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
      </div>
      {isOpen && (
        <div className={styles.menu}>
          {allowSelectAll && options.length > 0 && (
            <div className={styles.menuActions}>
              <button type="button" className={styles.menuActionButton} onClick={selectAllVisible}>
                Select all
              </button>
              <button type="button" className={styles.menuActionButton} onClick={clearAll}>
                Clear all
              </button>
            </div>
          )}
          {isLoading ? (
            <p className={styles.menuMessage}>Searching…</p>
          ) : options.length === 0 ? (
            <p className={styles.menuMessage}>No matches.</p>
          ) : (
            options.map((option) => {
              const isSelected = values.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                  onClick={() => toggle(option)}
                >
                  <span className={styles.optionCheck}>{isSelected ? '✓' : ''}</span>
                  {option.label}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
