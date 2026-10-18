import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SearchBar } from '../features/search/SearchBar';
import { fetchCart } from '../api/cart';
import { fetchWishlist } from '../api/wishlist';
import { fetchCategories } from '../api/categories';
import { useCustomer } from '../features/auth/useCustomer';
import { useAuthModal } from '../features/auth/AuthModalContext';
import { MegaMenu } from './MegaMenu';
import { MobileNavDrawer } from './MobileNavDrawer';
import styles from './Header.module.css';

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const { isLoggedIn } = useCustomer();
  const { openLoginModal } = useAuthModal();

  // Deliberately client-only, not part of SSR prefetch (plan §1a scopes SSR
  // to Home/PLP/Collection/PDP content only) — badge counts populate just
  // after hydration, which is fine since they carry no SEO value.
  const { data: cart } = useQuery({ queryKey: ['cart'], queryFn: fetchCart, staleTime: 30_000 });
  const { data: wishlist } = useQuery({
    queryKey: ['wishlist'],
    queryFn: fetchWishlist,
    staleTime: 30_000,
  });
  const cartCount = cart?.itemCount ?? 0;
  const wishlistCount = wishlist?.items.length ?? 0;

  const { data: categoriesData } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const categories = categoriesData?.categories ?? [];

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
      {/* Desktop/tablet header (>=768px) — unchanged markup, hidden below
          768px via CSS where the dedicated mobile bar below takes over. */}
      <div className={styles.inner}>
        <Link to="/" className={styles.logo} aria-label="9Karet — home">
          <img src="/images/logo.png" alt="9Karet" className={styles.logoImg} width={535} height={198} />
        </Link>

        <div className={styles.searchArea}>
          <SearchBar />
        </div>

        <nav className={styles.actions} aria-label="Account actions">
          <Link to="/wishlist" className={styles.actionLink} aria-label="Wishlist">
            <span className={styles.iconWrap}>
              <HeartIcon />
              {wishlistCount > 0 && <span className={styles.badge}>{wishlistCount}</span>}
            </span>
            <span className={styles.actionLabel}>Wishlist</span>
          </Link>
          {isLoggedIn ? (
            <Link to="/account/orders" className={styles.actionLink} aria-label="Account">
              <span className={styles.iconWrap}>
                <UserIcon />
              </span>
              <span className={styles.actionLabel}>Account</span>
            </Link>
          ) : (
            <button
              type="button"
              className={`${styles.actionLink} ${styles.linkButton}`}
              aria-label="My Account"
              onClick={openLoginModal}
            >
              <span className={styles.iconWrap}>
                <UserIcon />
              </span>
              <span className={styles.actionLabel}>My Account</span>
            </button>
          )}
          <Link to="/cart" className={`${styles.actionLink} ${styles.cartAction}`} aria-label="Cart">
            <span className={styles.iconWrap}>
              <BagIcon />
              {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
            </span>
            <span className={styles.actionLabel}>Cart</span>
          </Link>
        </nav>
      </div>

      <MegaMenu categories={categories} />

      {/* Mobile header (<768px) — hamburger / centred logo / search+wishlist
          +cart icons, built independently of the desktop block above so
          nothing here can affect it. */}
      <div className={styles.mobileBar}>
        <div className={styles.mobileMenuBtnWrap}>
          <button
            type="button"
            className={styles.mobileIconBtn}
            aria-label="Open menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
          >
            <MenuIcon size={25} strokeWidth={1.7} />
          </button>
        </div>

        <div className={styles.mobileLogoWrap}>
          <Link to="/" className={styles.mobileLogo} aria-label="9Karet — home">
            <img src="/images/logo.png" alt="9Karet" className={styles.mobileLogoImg} width={535} height={198} />
          </Link>
        </div>

        <div className={styles.mobileActions}>
          <button
            type="button"
            className={styles.mobileIconBtn}
            aria-label="Search"
            aria-expanded={isMobileSearchOpen}
            aria-controls="mobile-search-row"
            onClick={() => setIsMobileSearchOpen((v) => !v)}
          >
            <SearchIcon size={25} strokeWidth={1.7} />
          </button>
          <Link to="/wishlist" className={styles.mobileIconBtn} aria-label="Wishlist">
            <HeartIcon size={25} strokeWidth={1.7} />
            {wishlistCount > 0 && (
              <span className={styles.mobileBadge}>{wishlistCount > 9 ? '9+' : wishlistCount}</span>
            )}
          </Link>
          <Link to="/cart" className={styles.mobileIconBtn} aria-label="Cart">
            <BagIcon size={25} strokeWidth={1.7} />
            {cartCount > 0 && <span className={styles.mobileBadge}>{cartCount > 9 ? '9+' : cartCount}</span>}
          </Link>
        </div>
      </div>

      {isMobileSearchOpen && (
        <div id="mobile-search-row" className={styles.mobileSearchRow}>
          <SearchBar />
        </div>
      )}

      {isMobileMenuOpen && (
        <MobileNavDrawer
          categories={categories}
          wishlistCount={wishlistCount}
          isLoggedIn={isLoggedIn}
          onClose={() => setIsMobileMenuOpen(false)}
          onOpenLogin={openLoginModal}
        />
      )}
    </header>
  );
}

interface IconProps {
  size?: number;
  strokeWidth?: number;
}

// size/strokeWidth default to the existing desktop values — the mobile
// header (below) passes its own slightly larger size + 1.7 stroke without
// touching a single desktop call site, so desktop rendering is byte-for-
// byte unchanged.
function MenuIcon({ size = 22, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
    </svg>
  );
}

function HeartIcon({ size = 22, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M12 21s-7.5-4.7-10-9.3C.5 8.1 2.3 4.5 6 4c2-.3 3.7.6 6 3 2.3-2.4 4-3.3 6-3 3.7.5 5.5 4.1 4 7.7C19.5 16.3 12 21 12 21z" />
    </svg>
  );
}

function UserIcon({ size = 22, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

function BagIcon({ size = 22, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

// Mobile-header-only (matches SearchBar's own inline search-icon glyph for
// visual consistency between the icon that opens it and the field itself).
function SearchIcon({ size = 22, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
