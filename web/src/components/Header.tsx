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
import { BOX_DIAMONDS_URL, STORES_URL } from '../config';
import styles from './Header.module.css';

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
      {/* Desktop/tablet header (>=768px), hidden below 768px via CSS where
          the dedicated mobile bar below takes over. */}
      <div className={styles.inner}>
        <Link to="/" className={styles.logo} aria-label="9Karet — home">
          <img src="/images/logo.png" alt="9Karet" className={styles.logoImg} width={535} height={198} />
        </Link>

        <div className={styles.searchArea}>
          <SearchBar variant="header" />
        </div>

        <div className={styles.quickLinks}>
          {BOX_DIAMONDS_URL ? (
            <a href={BOX_DIAMONDS_URL} className={`${styles.quickLink} ${styles.diamondsLink}`} target="_blank" rel="noopener noreferrer">
              <DiamondsLinkContent />
            </a>
          ) : (
            <span className={`${styles.quickLink} ${styles.diamondsLink}`}>
              <DiamondsLinkContent />
            </span>
          )}
          {STORES_URL ? (
            <Link to={STORES_URL} className={`${styles.quickLink} ${styles.storesLink}`}>
              <StoreIcon />
              <span className={styles.quickLinkText}>Stores</span>
            </Link>
          ) : (
            <span className={`${styles.quickLink} ${styles.storesLink}`}>
              <StoreIcon />
              <span className={styles.quickLinkText}>Stores</span>
            </span>
          )}
        </div>

        <nav className={styles.actions} aria-label="Account actions">
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
          <Link to="/wishlist" className={styles.actionLink} aria-label="Wishlist">
            <span className={styles.iconWrap}>
              <HeartIcon />
              {wishlistCount > 0 && <span className={styles.badge}>{wishlistCount}</span>}
            </span>
            <span className={styles.actionLabel}>Wishlist</span>
          </Link>
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

      {/* Phones: "Explore Diamonds" + "Stores" as a slim strip ABOVE the
          logo row. */}
      <div className={styles.mobileQuickRow}>
        {BOX_DIAMONDS_URL ? (
          <a href={BOX_DIAMONDS_URL} className={`${styles.mobileQuickLink} ${styles.diamondsLink}`} target="_blank" rel="noopener noreferrer">
            <DiamondIcon />
            <span>Explore Diamonds</span>
          </a>
        ) : (
          <span className={`${styles.mobileQuickLink} ${styles.diamondsLink}`}>
            <DiamondIcon />
            <span>Explore Diamonds</span>
          </span>
        )}
        {STORES_URL ? (
          <Link to={STORES_URL} className={`${styles.mobileQuickLink} ${styles.storesLink}`}>
            <StoreIcon />
            <span>Stores</span>
          </Link>
        ) : (
          <span className={`${styles.mobileQuickLink} ${styles.storesLink}`}>
            <StoreIcon />
            <span>Stores</span>
          </span>
        )}
      </div>

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

      {/* Phones: the search box is always shown under the logo row. */}
      <div id="mobile-search-row" className={styles.mobileSearchRow}>
        <SearchBar />
      </div>

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

// "Explore Diamonds Collection" button contents (shared by the link and the
// not-yet-linked fallback).
function DiamondsLinkContent() {
  return (
    <>
      <DiamondIcon />
      <span className={styles.quickLinkText}>Explore Diamonds Collection</span>
    </>
  );
}

function DiamondIcon() {
  return (
    <svg className={styles.quickLinkIcon} width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 3.5h11l4 5.5L12 21 2.5 9l4-5.5z" fill="#f3e3c3" stroke="#c6a15b" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2.5 9h19M9 3.5 7.8 9 12 21l4.2-12L15 3.5M7.8 9 12 3.5 16.2 9" fill="none" stroke="#c6a15b" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg className={styles.quickLinkIcon} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 9.5 5 4h14l1.5 5.5" />
      <path d="M3.5 9.5c0 1.4 1.1 2.5 2.4 2.5s2.4-1.1 2.4-2.5c0 1.4 1.2 2.5 2.6 2.5h.2c1.4 0 2.6-1.1 2.6-2.5 0 1.4 1.1 2.5 2.4 2.5s2.4-1.1 2.4-2.5" />
      <path d="M5 12v8h14v-8M10 20v-4.5h4V20" />
    </svg>
  );
}
