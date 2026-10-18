import { NavLink, Outlet } from 'react-router-dom';
import { RepriceProgressBanner } from './RepriceProgressBanner';
import sharedStyles from '../../styles/shared.module.css';
import styles from './pricing.module.css';

const TABS = [
  { to: '/pricing/rates', label: 'Rates & Stones' },
  { to: '/pricing/making-charge-rules', label: 'Making Charge Rules' },
  { to: '/pricing/stone-rules', label: 'Stone Rules' },
  { to: '/pricing/overrides', label: 'Product Overrides' },
  { to: '/pricing/audit', label: 'Audit History' },
];

// The permission check for this whole section already happens once, in
// App.tsx's <RequirePermission permission="pricing"> wrapping this layout —
// every sub-page shares that same gate, so none of them need their own.
export function PricingLayout() {
  return (
    <div className={styles.pricingPage}>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>Pricing</h1>
      </div>

      <RepriceProgressBanner />

      <nav className={styles.tabs}>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
