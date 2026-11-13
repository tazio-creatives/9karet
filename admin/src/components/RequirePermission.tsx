import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '../features/auth/useAdmin';
import { hasPermission, isSuperAdmin, type AdminPermissionModule } from '../utils/permissions';
import { NAV_ITEMS } from '../layouts/navItems';

// Route-level counterpart to AdminLayout's nav filtering — hiding a link
// doesn't stop someone from typing the URL directly, so each route this
// wraps re-checks the same permission and bounces to the first route the
// admin's role actually allows (rather than rendering a page whose data
// requests would just 403 from the backend's own requirePermission gate).
export function RequirePermission({
  permission,
  superAdminOnly,
  children,
}: {
  permission?: AdminPermissionModule;
  superAdminOnly?: boolean;
  children: ReactNode;
}) {
  const { admin } = useAdmin();
  const allowed = superAdminOnly ? isSuperAdmin(admin) : hasPermission(admin, permission!);
  if (allowed) return <>{children}</>;

  const fallback = NAV_ITEMS.find((item) =>
    item.superAdminOnly ? isSuperAdmin(admin) : hasPermission(admin, item.permission!),
  );
  return <Navigate to={fallback?.to ?? '/login'} replace />;
}
