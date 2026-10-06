import { useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from '../api/auth';
import { useAdmin } from '../features/auth/useAdmin';
import { hasPermission, isSuperAdmin } from '../utils/permissions';
import { OrderAlerts } from '../features/orderAlerts/OrderAlerts';
import { SidebarContext } from './SidebarContext';
import { NAV_ITEMS } from './navItems';
import styles from './AdminLayout.module.css';

const COLLAPSE_STORAGE_KEY = 'admin-sidebar-collapsed';

function CollapseToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="10" y1="4" x2="10" y2="20" />
      {collapsed ? <path d="M13.5 9l3 3-3 3" /> : <path d="M16.5 9l-3 3 3 3" />}
    </svg>
  );
}

export function AdminLayout() {
  const { admin, isLoggedIn, isLoading } = useAdmin();
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1',
  );

  if (!isLoading && !isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) return null;

  async function handleLogout() {
    await logout();
    queryClient.setQueryData(['me'], null);
  }

  function toggleCollapsed() {
    setIsCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  function collapseSidebar() {
    setIsCollapsed(true);
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, '1');
  }

  const initial = admin?.fullName?.trim().charAt(0).toUpperCase() ?? '?';
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    item.superAdminOnly ? isSuperAdmin(admin) : hasPermission(admin, item.permission!),
  );

  return (
    <div className={`${styles.shell} ${isCollapsed ? styles.shellCollapsed : ''}`}>
      <aside className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.brandRow}>
          {!isCollapsed && (
            <div className={styles.brand}>
              <img src="/images/logo-sidebar.png" alt="Box Diamonds" className={styles.brandLogo} />
            </div>
          )}
          <button
            type="button"
            className={styles.collapseToggle}
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <CollapseToggleIcon collapsed={isCollapsed} />
          </button>
        </div>
        <nav className={styles.nav}>
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
              title={isCollapsed ? item.label : undefined}
              onClick={item.collapseOnClick ? collapseSidebar : undefined}
            >
              <item.icon />
              {!isCollapsed && item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.footer}>
          <div className={styles.adminIdentity}>
            <div className={styles.avatar} title={isCollapsed ? admin?.fullName : undefined}>
              {initial}
            </div>
            {!isCollapsed && (
              <div>
                <p className={styles.adminName}>{admin?.fullName}</p>
                <p className={styles.adminRole}>{admin?.role.name}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            className={styles.logoutButton}
            onClick={handleLogout}
            title={isCollapsed ? 'Sign Out' : undefined}
          >
            {isCollapsed ? '⏻' : 'Sign Out'}
          </button>
        </div>
      </aside>
      {hasPermission(admin, 'orders') && <OrderAlerts />}
      <main className={styles.content}>
        <SidebarContext.Provider value={{ isCollapsed, collapseSidebar }}>
          <Outlet />
        </SidebarContext.Provider>
      </main>
    </div>
  );
}
