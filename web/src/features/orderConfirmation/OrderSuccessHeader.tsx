import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCart } from '../../api/cart';
import { fetchCategories } from '../../api/categories';
import { useCustomer } from '../auth/useCustomer';
import { useAuthModal } from '../auth/AuthModalContext';
import { MobileCategoryList } from '../../components/MegaMenu';
import styles from './OrderSuccessHeader.module.css';

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

// Compact header for the Order Success page only — hamburger, logo, cart,
// deliberately no search bar or category nav row (the customer just placed
// an order, this isn't a browsing moment). The hamburger still opens the
// same category/account panel as the main site Header so it's not a dead
// button, just presented minimally.
export function OrderSuccessHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isLoggedIn } = useCustomer();
  const { openLoginModal } = useAuthModal();

  const { data: cart } = useQuery({ queryKey: ['cart'], queryFn: fetchCart, staleTime: 30_000 });
  const cartCount = cart?.itemCount ?? 0;

  const { data: categoriesData } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const categories = categoriesData?.categories ?? [];

  useEffect(() => {
    if (!isMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.menuArea} ref={menuRef}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
            aria-controls="order-success-menu-panel"
            onClick={() => setIsMenuOpen((v) => !v)}
          >
            <MenuIcon />
          </button>
          {isMenuOpen && (
            <div id="order-success-menu-panel" className={styles.menuPanel} role="menu">
              <MobileCategoryList categories={categories} onNavigate={() => setIsMenuOpen(false)} />
              {isLoggedIn ? (
                <Link to="/account/orders" className={styles.menuLink} role="menuitem" onClick={() => setIsMenuOpen(false)}>
                  Account
                </Link>
              ) : (
                <button
                  type="button"
                  className={`${styles.menuLink} ${styles.linkButton}`}
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    openLoginModal();
                  }}
                >
                  My Account
                </button>
              )}
            </div>
          )}
        </div>

        <Link to="/" className={styles.logo} aria-label="9Karet — home">
          <img src="/images/logo.png" alt="9Karet" className={styles.logoImg} />
        </Link>

        <Link to="/cart" className={styles.iconButton} aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}>
          <BagIcon />
          {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
        </Link>
      </div>
    </header>
  );
}
