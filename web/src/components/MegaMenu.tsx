import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Category } from '../api/types';
import styles from './MegaMenu.module.css';

interface CategoryNode extends Category {
  children: Category[];
}

function buildTree(categories: Category[]): CategoryNode[] {
  const active = categories.filter((c) => c.isActive);
  const byParent = new Map<string, Category[]>();
  for (const c of active) {
    const key = c.parentId ?? 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  const bySortOrder = (a: Category, b: Category) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  const roots = (byParent.get('root') ?? []).sort(bySortOrder);
  return roots.map((root) => ({ ...root, children: (byParent.get(root.id) ?? []).sort(bySortOrder) }));
}

const PRICE_BUCKETS: { label: string; priceMin?: number; priceMax?: number }[] = [
  { label: 'Below ₹10,000', priceMax: 10000 },
  { label: '₹10,000 – ₹20,000', priceMin: 10000, priceMax: 20000 },
  { label: '₹20,000 – ₹30,000', priceMin: 20000, priceMax: 30000 },
  { label: '₹30,000 – ₹40,000', priceMin: 30000, priceMax: 40000 },
  { label: '₹40,000 – ₹50,000', priceMin: 40000, priceMax: 50000 },
  { label: '₹50,000 and above', priceMin: 50000 },
];

function priceBucketHref(slug: string, bucket: (typeof PRICE_BUCKETS)[number]): string {
  const params = new URLSearchParams();
  if (bucket.priceMin != null) params.set('priceMin', String(bucket.priceMin));
  if (bucket.priceMax != null) params.set('priceMax', String(bucket.priceMax));
  return `/${slug}?${params.toString()}`;
}

function ChevronDownIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Desktop only (hidden under Header's 900px breakpoint) — the mobile menu
// panel already opened from the hamburger button gets a flat category list
// instead (MobileCategoryList below), since a hover-driven mega panel has no
// touch equivalent worth building separately.
export function MegaMenu({ categories }: { categories: Category[] }) {
  const tree = buildTree(categories);
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  function open(id: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenId(id);
  }
  function scheduleClose() {
    closeTimer.current = setTimeout(() => setOpenId(null), 150);
  }

  // Click-outside / Escape close — covers the click-to-toggle path below,
  // which hover's mouseleave alone wouldn't catch (e.g. tapped open, then
  // tapped elsewhere on a trackpad/touch device).
  useEffect(() => {
    if (!openId) return;
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenId(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenId(null);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openId]);

  if (tree.length === 0) return null;

  return (
    <nav className={styles.megaNav} aria-label="Shop by category" ref={navRef}>
      <ul className={styles.list}>
        {tree.map((cat) => (
          <li
            key={cat.id}
            className={styles.item}
            onMouseEnter={() => open(cat.id)}
            onMouseLeave={scheduleClose}
          >
            {cat.children.length > 0 ? (
              <button
                type="button"
                className={styles.topLink}
                aria-expanded={openId === cat.id}
                onClick={() => (openId === cat.id ? setOpenId(null) : open(cat.id))}
              >
                {cat.name}
                <ChevronDownIcon />
              </button>
            ) : (
              <Link to={`/${cat.slug}`} className={styles.topLink}>
                {cat.name}
              </Link>
            )}

            {cat.children.length > 0 && openId === cat.id && (
              <div className={styles.panel}>
                <div className={styles.panelColumns}>
                  <div className={styles.panelCol}>
                    <span className={styles.colHeading}>Popular {cat.name} Types</span>
                    <div className={styles.subGrid}>
                      {cat.children.map((sub) => (
                        <Link
                          key={sub.id}
                          to={`/${sub.slug}`}
                          className={styles.subLink}
                          onClick={() => setOpenId(null)}
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                    <Link
                      to={`/${cat.slug}`}
                      className={styles.viewAllButton}
                      onClick={() => setOpenId(null)}
                    >
                      View All {cat.name}
                    </Link>
                  </div>
                  <div className={`${styles.panelCol} ${styles.panelColRight}`}>
                    <span className={styles.colHeading}>By Price Range</span>
                    <div className={styles.priceList}>
                      {PRICE_BUCKETS.map((bucket) => (
                        <Link
                          key={bucket.label}
                          to={priceBucketHref(cat.slug, bucket)}
                          className={styles.priceLink}
                          onClick={() => setOpenId(null)}
                        >
                          {bucket.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Flat "TopCategory / Subcategory" list for the mobile hamburger panel —
// subcategories indented under their parent, no expand/collapse (mobile
// menus already scroll, and this keeps it a single predictable list).
export function MobileCategoryList({ categories, onNavigate }: { categories: Category[]; onNavigate: () => void }) {
  const tree = buildTree(categories);
  if (tree.length === 0) return null;

  return (
    <>
      {tree.map((cat) => (
        <div key={cat.id} className={styles.mobileGroup}>
          <Link to={`/${cat.slug}`} className={styles.mobileTopLink} onClick={onNavigate}>
            {cat.name}
          </Link>
          {cat.children.map((sub) => (
            <Link key={sub.id} to={`/${sub.slug}`} className={styles.mobileSubLink} onClick={onNavigate}>
              {sub.name}
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}
