import styles from './StickyActionBar.module.css';

function SortIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" />
    </svg>
  );
}

interface StickyActionBarProps {
  onSort: () => void;
  onFilter: () => void;
  isSortOpen: boolean;
  isFilterOpen: boolean;
  activeFilterCount: number;
}

// Always rendered (visibility purely CSS-gated to mobile, ≤767px) so SSR and
// client markup match — same pattern the existing .filtersButton toggle uses.
export function StickyActionBar({ onSort, onFilter, isSortOpen, isFilterOpen, activeFilterCount }: StickyActionBarProps) {
  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.action}
        onClick={onSort}
        aria-expanded={isSortOpen}
        aria-haspopup="dialog"
      >
        <SortIcon />
        <span>Sort By</span>
      </button>
      <span className={styles.divider} aria-hidden="true" />
      <button
        type="button"
        className={styles.action}
        onClick={onFilter}
        aria-expanded={isFilterOpen}
        aria-haspopup="dialog"
      >
        <FilterIcon />
        <span>Filter</span>
        {activeFilterCount > 0 && <span className={styles.badge}>{activeFilterCount}</span>}
      </button>
    </div>
  );
}
