// The full set of assignable admin permission modules — one per nav
// section, roughly. A role's `permissions` JSONB array holds a subset of
// these values (or the literal '*' wildcard, reserved for SUPER_ADMIN).
// Deliberately excludes admin-user/role management itself — that stays
// hardcoded to SUPER_ADMIN via requireRole (adminUsers.routes.js), never
// assignable through this list, so a misconfigured custom role can never
// grant itself the ability to create more admins.
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
];
