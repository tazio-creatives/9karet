import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchProducts } from '../api/products';
import { fetchHomepage } from '../api/homepage';
import type { Category, SortOption } from '../api/types';
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
  { label: 'Under 10k', priceMax: 10000 },
  { label: '10k To 20k', priceMin: 10000, priceMax: 20000 },
  { label: '20k To 30k', priceMin: 20000, priceMax: 30000 },
  { label: '30k To 40k', priceMin: 30000, priceMax: 40000 },
  { label: '40k To 50k', priceMin: 40000, priceMax: 50000 },
  { label: '50k & Above', priceMin: 50000 },
];

// "Shop By" column — sort shortcuts into the category listing, each with a
// small round gold icon (the listing page already reads ?sort=).
const SHOP_BY: { label: string; sort: SortOption; icon: 'star' | 'spark' | 'tag' }[] = [
  { label: 'Bestsellers', sort: 'bestseller', icon: 'star' },
  { label: 'New Arrivals', sort: 'newest', icon: 'spark' },
  { label: 'Price: Low to High', sort: 'price_asc', icon: 'tag' },
];

function ShopByIcon({ icon }: { icon: 'star' | 'spark' | 'tag' }) {
  return (
    <span className={styles.shopIcon} aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {icon === 'star' && <polygon points="12 3 14.8 9 21 9.6 16.3 13.8 17.7 20 12 16.7 6.3 20 7.7 13.8 3 9.6 9.2 9" />}
        {icon === 'spark' && <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />}
        {icon === 'tag' && (
          <>
            <path d="M3 12V4h8l10 10-8 8z" />
            <circle cx="7.5" cy="8.5" r="1.3" />
          </>
        )}
      </svg>
    </span>
  );
}

// Photo on the right of the panel, first match wins:
//   1. the category image uploaded in admin (Categories),
//   2. that category's photo in the homepage Category Strip,
//   3. the first product photo from that category.
// Hovering a subcategory swaps to that subcategory's photo.
function useStripPhotos() {
  const { data } = useQuery({ queryKey: ['homepage'], queryFn: fetchHomepage, staleTime: 5 * 60_000 });
  const map = new Map<string, string>();
  for (const section of data?.sections ?? []) {
    if (section.type !== 'CATEGORY_STRIP') continue;
    for (const item of section.items) {
      const photo = item.imageUrl || item.imageUrlMobile;
      if (item.category && photo && !map.has(item.category.id)) map.set(item.category.id, photo);
    }
  }
  return map;
}

function useCategoryPhoto(category: Category | null, stripPhotos: Map<string, string>) {
  const known = category ? category.imageUrl || stripPhotos.get(category.id) || null : null;
  const { data } = useQuery({
    queryKey: ['mega-menu-photo', category?.slug],
    queryFn: () => fetchProducts({ category: category!.slug, limit: 1 }),
    enabled: !!category && !known,
    staleTime: 10 * 60_000,
  });
  if (!category) return null;
  return known || data?.products[0]?.primaryImageUrl || null;
}

function PanelPhoto({ category, hovered, onNavigate }: { category: Category; hovered: Category | null; onNavigate: () => void }) {
  const stripPhotos = useStripPhotos();
  const mainPhoto = useCategoryPhoto(category, stripPhotos);
  const hoveredPhoto = useCategoryPhoto(hovered, stripPhotos);
  const target = hovered && hoveredPhoto ? hovered : category;
  const src = (hovered && hoveredPhoto) || mainPhoto;
  if (!src) return null;
  return (
    <Link to={`/${target.slug}`} className={styles.photo} onClick={onNavigate}>
      <img src={src} alt={target.name} loading="lazy" />
      <span className={styles.photoLabel}>Shop {target.name}</span>
    </Link>
  );
}

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
  const [hoveredSub, setHoveredSub] = useState<Category | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  function open(id: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (id !== openId) setHoveredSub(null);
    setOpenId(id);
  }
  const close = () => setOpenId(null);
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
              <Link to={`/${cat.slug}`} className={styles.topLink} onClick={close}>
                {cat.name}
              </Link>
            )}

            {openId === cat.id && (
              <div className={styles.panel}>
                <div className={styles.panelInner}>
                  {cat.children.length > 0 && (
                    <div className={styles.styleCol}>
                      <span className={styles.colHeading}>By Style</span>
                      <div className={styles.subGrid} onMouseLeave={() => setHoveredSub(null)}>
                        {cat.children.map((sub) => (
                          <Link
                            key={sub.id}
                            to={`/${sub.slug}`}
                            className={styles.subLink}
                            onMouseEnter={() => setHoveredSub(sub)}
                            onFocus={() => setHoveredSub(sub)}
                            onClick={close}
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                      <Link to={`/${cat.slug}`} className={styles.viewAllButton} onClick={close}>
                        View All
                      </Link>
                    </div>
                  )}
                  <div className={styles.col}>
                    <span className={styles.colHeading}>Shop By</span>
                    <div className={styles.shopList}>
                      {SHOP_BY.map((item) => (
                        <Link
                          key={item.sort}
                          to={`/${cat.slug}?sort=${item.sort}`}
                          className={styles.shopLink}
                          onClick={close}
                        >
                          <ShopByIcon icon={item.icon} />
                          {item.label}
                        </Link>
                      ))}
                    </div>
                    {cat.children.length === 0 && (
                      <Link to={`/${cat.slug}`} className={styles.viewAllButton} onClick={close}>
                        View All
                      </Link>
                    )}
                  </div>
                  <div className={styles.col}>
                    <span className={styles.colHeading}>By Price</span>
                    <div className={styles.priceList}>
                      {PRICE_BUCKETS.map((bucket) => (
                        <Link
                          key={bucket.label}
                          to={priceBucketHref(cat.slug, bucket)}
                          className={styles.priceLink}
                          onClick={close}
                        >
                          {bucket.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <PanelPhoto category={cat} hovered={hoveredSub} onNavigate={close} />
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
