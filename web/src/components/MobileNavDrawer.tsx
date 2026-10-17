import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Category } from '../api/types';
import styles from './MobileNavDrawer.module.css';

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M12 21s-7.5-4.7-10-9.3C.5 8.1 2.3 4.5 6 4c2-.3 3.7.6 6 3 2.3-2.4 4-3.3 6-3 3.7.5 5.5 4.1 4 7.7C19.5 16.3 12 21 12 21z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

// Branded fallback for a category with no image configured yet — never a
// blank tile.
function PlaceholderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M2 9h20M9 3l3 6-3 12M15 3l-3 6 3 12" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

interface MobileNavDrawerProps {
  categories: Category[];
  wishlistCount: number;
  isLoggedIn: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
}

// Full-height mobile navigation drawer (<768px only — see .overlay/.drawer's
// own media query, a no-op at every wider width regardless of when this
// mounts). Replaces the old small anchored dropdown: a sticky header
// (logo/wishlist/account/close) plus one independently-scrollable "Shop by
// Category" tile grid — the only content, since every other nav link
// (New Arrivals, Best Sellers, Collections, Gifting, etc.) is deliberately
// left off per this redesign.
export function MobileNavDrawer({ categories, wishlistCount, isLoggedIn, onClose, onOpenLogin }: MobileNavDrawerProps) {
  // Top-level categories only, in admin-configured order — same set the
  // homepage's own "Shop by Category" section shows, so this drawer and
  // the homepage never disagree about what "every category" means.
  const topLevelCategories = useMemo(
    () =>
      categories
        .filter((c) => c.parentId === null && c.isActive)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  // Active subcategories grouped by their parent's id, admin-ordered — a
  // tile only gets an expand chevron when this map has a non-empty entry
  // for it.
  const childrenByParentId = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of categories) {
      if (c.parentId && c.isActive) {
        const list = map.get(c.parentId) ?? [];
        list.push(c);
        map.set(c.parentId, list);
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return map;
  }, [categories]);

  // Independent per-tile expand/collapse — tapping the tile itself still
  // navigates straight to that category; the chevron is a separate control
  // that only reveals subcategory links in place, never navigates on its
  // own.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div id="mobile-nav-drawer" className={styles.drawer} role="dialog" aria-modal="true" aria-label="Menu">
        <div className={styles.header}>
          <Link to="/" className={styles.logo} onClick={onClose} aria-label="Box Diamonds — home">
            <img src="/images/logo.png" alt="Box Diamonds" className={styles.logoImg} width={260} height={166} />
          </Link>
          <div className={styles.headerActions}>
            <Link to="/wishlist" className={styles.iconBtn} onClick={onClose} aria-label="Wishlist">
              <HeartIcon />
              {wishlistCount > 0 && <span className={styles.badge}>{wishlistCount > 9 ? '9+' : wishlistCount}</span>}
            </Link>
            {isLoggedIn ? (
              <Link to="/account/orders" className={styles.iconBtn} onClick={onClose} aria-label="Account">
                <UserIcon />
              </Link>
            ) : (
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="My Account"
                onClick={() => {
                  onClose();
                  onOpenLogin();
                }}
              >
                <UserIcon />
              </button>
            )}
            <button type="button" className={styles.iconBtn} aria-label="Close menu" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <h2 className={styles.sectionHeading}>Shop by Category</h2>
          <div className={styles.grid}>
            {topLevelCategories.map((category) => {
              const children = childrenByParentId.get(category.id) ?? [];
              const hasChildren = children.length > 0;
              const isExpanded = expandedIds.has(category.id);
              return (
                <div key={category.id} className={styles.tileWrap}>
                  <div className={styles.tile}>
                    <Link
                      to={`/${category.slug}`}
                      className={styles.tileLink}
                      aria-label={`Shop ${category.name}`}
                      onClick={onClose}
                    >
                      <span className={styles.tileName}>{category.name}</span>
                      <span className={styles.tileImageWrap}>
                        {category.imageUrl ? (
                          <img src={category.imageUrl} alt="" className={styles.tileImage} loading="lazy" decoding="async" />
                        ) : (
                          <PlaceholderIcon />
                        )}
                      </span>
                    </Link>
                    {hasChildren && (
                      <button
                        type="button"
                        className={`${styles.expandBtn} ${isExpanded ? styles.expandBtnOpen : ''}`}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Hide' : 'Show'} ${category.name} subcategories`}
                        onClick={() => toggleExpanded(category.id)}
                      >
                        <ChevronIcon />
                      </button>
                    )}
                  </div>
                  {hasChildren && isExpanded && (
                    <div className={styles.subList}>
                      {children.map((sub) => (
                        <Link key={sub.id} to={`/${sub.slug}`} className={styles.subLink} onClick={onClose}>
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
