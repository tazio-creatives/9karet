import type { Admin } from '../api/types';

// Mirrors backend/src/constants/adminPermissions.js — kept in sync by hand
// (no shared package between the two apps in this repo, same convention as
// other duplicated vocabularies like order statuses).
export const ADMIN_PERMISSION_MODULES = [
  'dashboard',
  'orders',
  'products',
  'categories',
  'collections',
  'homepage',
  'customers',
  'reviews',
  'coupons',
  'pricing',
  'attributes',
  'audit-logs',
  'messages',
  'blog',
] as const;

export type AdminPermissionModule = (typeof ADMIN_PERMISSION_MODULES)[number];

export const PERMISSION_LABELS: Record<AdminPermissionModule, string> = {
  dashboard: 'Dashboard',
  orders: 'Orders',
  products: 'Products',
  categories: 'Categories',
  collections: 'Collections',
  homepage: 'Homepage',
  customers: 'Customers',
  reviews: 'Reviews',
  coupons: 'Coupons',
  pricing: 'Pricing',
  attributes: 'Attributes',
  'audit-logs': 'Audit Logs',
  messages: 'Messages',
  blog: 'Blog',
};

export function hasPermission(admin: Admin | null | undefined, module: AdminPermissionModule): boolean {
  const permissions = admin?.role.permissions;
  return !!permissions && (permissions.includes('*') || permissions.includes(module));
}

// Admin Users / Roles management is deliberately NOT one of the assignable
// modules above (see the backend constant's own comment) — it stays
// SUPER_ADMIN-only via the wildcard, same gate the backend's requireRole
// enforces, so a custom role can never grant itself the ability to create
// more admins.
export function isSuperAdmin(admin: Admin | null | undefined): boolean {
  return !!admin?.role.permissions.includes('*');
}
