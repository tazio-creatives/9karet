import { Suspense } from 'react';
import { NavLink, Outlet, useNavigate, useMatch } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useCustomer } from '../features/auth/useCustomer';
import { SignInRequired } from '../features/auth/SignInRequired';
import { logout } from '../api/customers';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { RouteFallback } from '../components/RouteFallback';
import styles from './AccountLayout.module.css';

function initials(name: string | null) {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

// Mobile numbers are stored/returned as +91XXXXXXXXXX (see utils/mobile.js
// normalizeMobile) — masks the first 5 of the 10 digits, matching the
// reference's "+91 ••••• 43210" pattern.
function maskMobile(mobile: string) {
  const digits = mobile.replace(/^\+91/, '');
  return `+91 ${'•'.repeat(5)} ${digits.slice(-5)}`;
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 11l8-7 8 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 21s-7.5-4.7-10-9.3C.5 8.1 2.3 4.5 6 4c2-.3 3.7.6 6 3 2.3-2.4 4-3.3 6-3 3.7.5 5.5 4.1 4 7.7C19.5 16.3 12 21 12 21z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Mobile-only (see .identityChevron) — decorative, matches the reference
// design's profile-row affordance; the row itself has no expand/collapse
// behaviour to trigger.
function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AccountLayout() {
  const { customer, isLoggedIn, isLoading } = useCustomer();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Order Details gets its own narrower (190px) sidebar + a 350px tracking
  // column inside .content — every other account page keeps the standard
  // 260px sidebar untouched.
  const isOrderDetailRoute = Boolean(useMatch('/account/orders/:orderId'));

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      // Write null directly rather than invalidating — /customers/me is
      // auth-gated, so a post-logout refetch of it 401s, and React Query
      // keeps showing the last successful (logged-in) data on a query
      // error instead of clearing it. Mirrors admin/src/layouts/AdminLayout.tsx.
      queryClient.setQueryData(['me'], null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['cart'] }),
        queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
      ]);
      navigate('/', { replace: true });
    },
  });

  if (!isLoading && !isLoggedIn) {
    return (
      <div className={styles.page}>
        <SignInRequired message="Sign in to view your account, orders and saved addresses." />
      </div>
    );
  }

  if (isLoading || !customer) return null;

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
      <Breadcrumbs items={[{ label: 'My Account' }]} />
      <h1 className={styles.heading}>My Account</h1>
      <p className={`${styles.subheading} ${isOrderDetailRoute ? styles.subheadingCompact : ''}`}>
        Manage your orders, addresses and account details.
      </p>

      <div className={`${styles.layout} ${isOrderDetailRoute ? styles.layoutNarrowSidebar : ''}`}>
        <aside className={styles.sidebar}>
          <div className={styles.identity}>
            <div className={styles.avatar}>{initials(customer.fullName)}</div>
            <div className={styles.identityText}>
              <p className={styles.name}>{customer.fullName || 'Welcome'}</p>
              <p className={styles.mobile}>{maskMobile(customer.mobileNumber)}</p>
            </div>
            {/* Every logged-in customer authenticated via OTP — phone
                verification isn't a separate optional step in this app. */}
            <span className={styles.verifiedBadge}>Verified</span>
            <span className={styles.identityChevron}>
              <ChevronRightIcon />
            </span>
          </div>

          {/* Same six links/actions as a 1-column list on desktop and a
              2-column grid on mobile (see .nav's media query) — the DOM
              order (5 NavLinks then the Sign Out button, no divider
              element in between) is what lets the mobile grid's
              nth-child border/rounding rules land on the right cells. */}
          <nav className={styles.nav} aria-label="Account">
            {/* Redirects to /account/orders (see App.tsx's index route) — a
                separate entry point rather than a duplicate of "My Orders"
                below, so the two don't both show as active at once. */}
            <NavLink
              to="/account"
              end
              className={({ isActive }) => `${styles.navCell} ${isActive ? styles.navLinkActive : styles.navLink}`}
            >
              <HomeIcon />
              Overview
            </NavLink>
            <NavLink
              to="/account/orders"
              className={({ isActive }) => `${styles.navCell} ${isActive ? styles.navLinkActive : styles.navLink}`}
            >
              <BagIcon />
              My Orders
            </NavLink>
            <NavLink to="/wishlist" className={`${styles.navCell} ${styles.navLink}`}>
              <HeartIcon />
              Wishlist
            </NavLink>
            <NavLink
              to="/account/addresses"
              className={({ isActive }) => `${styles.navCell} ${isActive ? styles.navLinkActive : styles.navLink}`}
            >
              <PinIcon />
              Saved Addresses
            </NavLink>
            <NavLink
              to="/account/profile"
              className={({ isActive }) => `${styles.navCell} ${isActive ? styles.navLinkActive : styles.navLink}`}
            >
              <UserIcon />
              Profile Details
            </NavLink>
            <button
              type="button"
              className={`${styles.navCell} ${styles.signOutButton}`}
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
            >
              <SignOutIcon />
              {logoutMutation.isPending ? 'Signing out…' : 'Sign Out'}
            </button>
          </nav>
        </aside>

        <div className={styles.content}>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
      </div>
    </div>
  );
}
