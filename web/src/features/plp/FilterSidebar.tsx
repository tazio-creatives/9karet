import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchFilterOptions } from '../../api/categories';
import type { GoldColor, MetalType, Purity } from '../../api/types';
import { PriceRangeSlider } from './PriceRangeSlider';
import styles from './FilterSidebar.module.css';

// Metal and Karat options come from Admin → Attributes (Gold Color and
// Purity): a value switched off there is not offered here.
export const FILTER_OPTIONS_QUERY_KEY = ['filter-options'];

export interface FilterValues {
  metal?: MetalType;
  purity?: Purity;
  goldColor?: GoldColor;
  priceMin?: number;
  priceMax?: number;
}

export interface CategoryFilterGroup {
  currentLabel: string;
  total: number;
  items: { name: string; href: string; slug: string; count: number }[];
}

interface FilterSidebarProps {
  values: FilterValues;
  onChange: (_patch: FilterValues) => void;
  onClear: () => void;
  categoryFilter?: CategoryFilterGroup;
  // Drive the mobile slide-in drawer (item 6 of the redesign spec) — the
  // permanent sidebar itself becomes the drawer's content under 900px, so
  // this component owns its own open/close chrome rather than the caller
  // needing a second, separate drawer implementation.
  isOpen?: boolean;
  onClose?: () => void;
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={styles.chevron}
      style={{ transform: open ? 'rotate(180deg)' : 'none' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.group}>
      <button type="button" className={styles.groupHeadingButton} onClick={() => setOpen((o) => !o)}>
        <span className={styles.groupHeading}>{title}</span>
        <ChevronIcon open={open} />
      </button>
      {open && <div className={styles.groupBody}>{children}</div>}
    </div>
  );
}

export function FilterSidebar({ values, onChange, onClear, categoryFilter, isOpen = false, onClose }: FilterSidebarProps) {
  const hasActiveFilters =
    values.metal != null || values.purity != null || values.goldColor != null ||
    values.priceMin != null || values.priceMax != null;

  const { data: filterOptions } = useQuery({
    queryKey: FILTER_OPTIONS_QUERY_KEY,
    queryFn: fetchFilterOptions,
    staleTime: 5 * 60_000,
  });
  const metalOptions = (filterOptions?.goldColors ?? []).map((c) => ({
    label: c.label,
    metal: 'GOLD' as MetalType,
    goldColor: c.value as GoldColor,
  }));
  const karats = (filterOptions?.purities ?? []).map((p) => p.value as Purity);

  const selectedMetalOption = metalOptions.find(
    (m) => m.metal === values.metal && m.goldColor === (values.goldColor ?? null),
  );

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && <div className={styles.backdrop} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.filterHeader}>
          <span className={styles.filterHeaderTitle}>Filters</span>
          <div className={styles.filterHeaderActions}>
            {hasActiveFilters && (
              <button type="button" className={styles.clearButton} onClick={onClear}>
                Clear all
              </button>
            )}
            <button type="button" className={styles.closeButton} aria-label="Close filters" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
        </div>
        {categoryFilter && (
        <FilterGroup title="Category">
          <ul className={styles.checkList}>
            <li className={styles.checkItem}>
              <span className={`${styles.checkbox} ${styles.checkboxChecked}`} aria-hidden="true" />
              <span className={styles.checkLabel}>All {categoryFilter.currentLabel}</span>
              <span className={styles.checkCount}>{categoryFilter.total}</span>
            </li>
            {categoryFilter.items.map((item) => (
              <li key={item.href} className={styles.checkItem}>
                <Link to={item.href} className={styles.checkItemLink}>
                  <span className={styles.checkbox} aria-hidden="true" />
                  <span className={styles.checkLabel}>{item.name}</span>
                  <span className={styles.checkCount}>{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </FilterGroup>
      )}

      <FilterGroup title="Price Range">
        <PriceRangeSlider
          valueMin={values.priceMin}
          valueMax={values.priceMax}
          onCommit={(priceMin, priceMax) => onChange({ priceMin, priceMax })}
        />
      </FilterGroup>

      {metalOptions.length > 0 && (
      <FilterGroup title="Metal">
        <ul className={styles.checkList}>
          {metalOptions.map((option) => {
            const isChecked = selectedMetalOption?.goldColor === option.goldColor;
            return (
              <li key={option.label} className={styles.checkItem}>
                <button
                  type="button"
                  className={styles.checkItemButton}
                  onClick={() =>
                    onChange(
                      isChecked
                        ? { metal: undefined, goldColor: undefined }
                        : { metal: option.metal, goldColor: option.goldColor ?? undefined },
                    )
                  }
                >
                  <span className={`${styles.checkbox} ${isChecked ? styles.checkboxChecked : ''}`} aria-hidden="true" />
                  <span className={styles.checkLabel}>{option.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </FilterGroup>
      )}

      {/* Every 9Karet piece is 9K — a single-option Karat filter would
          filter nothing, so it only shows if more purities ever exist. */}
      {karats.length > 1 && (
      <FilterGroup title="Karat">
        <ul className={styles.checkList}>
          {karats.map((karat) => {
            const isChecked = values.purity === karat;
            return (
              <li key={karat} className={styles.checkItem}>
                <button
                  type="button"
                  className={styles.checkItemButton}
                  onClick={() => onChange({ purity: isChecked ? undefined : karat })}
                >
                  <span className={`${styles.checkbox} ${isChecked ? styles.checkboxChecked : ''}`} aria-hidden="true" />
                  <span className={styles.checkLabel}>{karat}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </FilterGroup>
      )}
      </aside>
    </>
  );
}
