import {
  DashboardIcon,
  ProductsIcon,
  CategoriesIcon,
  CollectionsIcon,
  HomepageIcon,
  OrdersIcon,
  CustomersIcon,
  ReviewsIcon,
  CouponsIcon,
  PricingIcon,
  AdminUsersIcon,
  AuditLogsIcon,
  AttributesIcon,
  MessagesIcon,
  BlogIcon,
} from './NavIcons';
import type { AdminPermissionModule } from '../utils/permissions';

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: typeof DashboardIcon;
  collapseOnClick?: boolean;
  permission?: AdminPermissionModule;
  superAdminOnly?: boolean;
}

// Shared by AdminLayout (sidebar rendering) and RequirePermission (computing
// where to send an admin who lands on a route their role can't see) — one
// list, one order, so "first item this admin can access" means the same
// thing in both places. `permission` gates visibility (utils/permissions.ts);
// `superAdminOnly` is the one exception (Admin Users/Roles), always gated on
// the SUPER_ADMIN wildcard specifically, matching the backend's
// requireRole('SUPER_ADMIN') on that router.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true, icon: DashboardIcon, permission: 'dashboard' },
  // Orders' table wants the full window width (see OrdersListPage's
  // ".full-width-page" opt-out) — collapsing the sidebar on the way in gives
  // it that room immediately instead of waiting on a manual toggle.
  { to: '/orders', label: 'Orders', icon: OrdersIcon, collapseOnClick: true, permission: 'orders' },
  { to: '/products', label: 'Products', icon: ProductsIcon, permission: 'products' },
  { to: '/categories', label: 'Categories', icon: CategoriesIcon, permission: 'categories' },
  { to: '/collections', label: 'Collections', icon: CollectionsIcon, permission: 'collections' },
  { to: '/homepage', label: 'Homepage', icon: HomepageIcon, permission: 'homepage' },
  { to: '/customers', label: 'Customers', icon: CustomersIcon, permission: 'customers' },
  { to: '/reviews', label: 'Reviews', icon: ReviewsIcon, permission: 'reviews' },
  { to: '/messages', label: 'Messages', icon: MessagesIcon, permission: 'messages' },
  { to: '/blog', label: 'Blog', icon: BlogIcon, permission: 'blog' },
  { to: '/coupons', label: 'Coupons', icon: CouponsIcon, permission: 'coupons' },
  { to: '/pricing', label: 'Pricing', icon: PricingIcon, permission: 'pricing' },
  { to: '/attributes', label: 'Attributes', icon: AttributesIcon, permission: 'attributes' },
  { to: '/admin-users', label: 'Admin Users', icon: AdminUsersIcon, superAdminOnly: true },
  { to: '/audit-logs', label: 'Audit Logs', icon: AuditLogsIcon, permission: 'audit-logs' },
];
