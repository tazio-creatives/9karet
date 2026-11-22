import { useEffect, useState, useRef } from 'react';
import { pixelSearch } from '../../analytics/metaPixel';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { search } from '../../api/search';
import { productUrl } from '../../utils/productUrl';
import { formatPrice } from '../../utils/formatPrice';
import { useDebouncedValue } from './useDebouncedValue';
import styles from './SearchBar.module.css';

// The search box hint cycles through these while the box is empty and not
// focused, so customers see what they can search for.
// Typing effect: "Search for " stays, the item is typed letter by letter,
// held, deleted, then the next one is typed.
const HINT_PREFIX = 'Search for ';
const SEARCH_HINTS = [
  'Gold Rings',
  'Earrings',
  'Necklaces',
  'Bracelets & Bangles',
  'Pendants',
  'Mangalsutra',
  "Men's Jewellery",
  'Kids Jewellery',
];
const TYPE_MS = 90;
const DELETE_MS = 45;
const HOLD_MS = 1600;
const NEXT_MS = 350;

export function SearchBar({ variant = 'default' }: { variant?: 'default' | 'header' } = {}) {
  const isHeader = variant === 'header';
  const [term, setTerm] = useState('');
  const [hintIndex, setHintIndex] = useState(0);
  const [typedLength, setTypedLength] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Typing effect — runs only while the box is empty and not being used.
  useEffect(() => {
    if (isFocused || term) return undefined;
    const word = SEARCH_HINTS[hintIndex];
    let delay: number;
    let step: () => void;
    if (!isDeleting && typedLength < word.length) {
      delay = TYPE_MS;
      step = () => setTypedLength((n) => n + 1);
    } else if (!isDeleting) {
      delay = HOLD_MS;
      step = () => setIsDeleting(true);
    } else if (typedLength > 0) {
      delay = DELETE_MS;
      step = () => setTypedLength((n) => n - 1);
    } else {
      delay = NEXT_MS;
      step = () => {
        setIsDeleting(false);
        setHintIndex((i) => (i + 1) % SEARCH_HINTS.length);
      };
    }
    const timer = window.setTimeout(step, delay);
    return () => window.clearTimeout(timer);
  }, [isFocused, term, hintIndex, typedLength, isDeleting]);
  const typedHint = HINT_PREFIX + SEARCH_HINTS[hintIndex].slice(0, typedLength);
  const [isOpen, setIsOpen] = useState(false);
  const debouncedTerm = useDebouncedValue(term.trim(), 300);
  // Results update live while typing; the Search event waits for the term to
  // settle so "r", "ri", "rin" aren't each counted as searches.
  const settledTerm = useDebouncedValue(term.trim(), 1200);
  useEffect(() => {
    if (settledTerm.length >= 3) pixelSearch(settledTerm);
  }, [settledTerm]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['search', debouncedTerm],
    queryFn: () => search(debouncedTerm),
    enabled: debouncedTerm.length > 0,
    staleTime: 30_000,
  });

  const showDropdown =
    isOpen &&
    debouncedTerm.length > 0 &&
    !!data &&
    (data.products.length > 0 || data.categories.length > 0 || data.collections.length > 0);

  return (
    <div className={`${styles.container} ${isHeader ? styles.headerVariant : ''}`} ref={containerRef}>
      <input
        ref={inputRef}
        type="search"
        className={styles.input}
        placeholder={isFocused ? 'Search jewellery...' : typedHint}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => {
          setIsOpen(true);
          setIsFocused(true);
        }}
        onBlur={() => {
          setIsFocused(false);
          setTimeout(() => setIsOpen(false), 150);
        }}
        aria-label="Search products"
      />
      {isHeader ? (
        <button
          type="button"
          className={styles.searchButton}
          aria-label="Search"
          onClick={() => inputRef.current?.focus()}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
        </button>
      ) : (
      <svg
        className={styles.searchIcon}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      )}
      {isOpen && debouncedTerm.length > 0 && (
        <div className={styles.dropdown} role="listbox">
          {isFetching && <p className={styles.empty}>Searching…</p>}
          {!isFetching && !showDropdown && (
            <p className={styles.empty}>No results for "{debouncedTerm}"</p>
          )}

          {data && data.categories.length > 0 && (
            <div className={styles.group}>
              <p className={styles.groupLabel}>Categories</p>
              {data.categories.map((c) => (
                <Link key={c.id} to={`/${c.slug}`} className={styles.resultRow}>
                  {c.name}
                </Link>
              ))}
            </div>
          )}

          {data && data.collections.length > 0 && (
            <div className={styles.group}>
              <p className={styles.groupLabel}>Collections</p>
              {data.collections.map((c) => (
                <Link key={c.id} to={`/collections/${c.slug}`} className={styles.resultRow}>
                  {c.name}
                </Link>
              ))}
            </div>
          )}

          {data && data.products.length > 0 && (
            <div className={styles.group}>
              <p className={styles.groupLabel}>Products</p>
              {data.products.map((p) => (
                <Link key={p.id} to={productUrl(p)} className={styles.resultRow}>
                  <span>{p.name}</span>
                  <span className={styles.price}>{formatPrice(p.sellingPrice)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
