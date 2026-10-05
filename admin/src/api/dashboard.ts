import { apiFetch } from './client';

export interface DashboardTopProduct {
  productId: string;
  name: string;
  slug: string | null;
  primaryImageUrl: string | null;
  unitsSold: number;
  revenue: number;
}

export interface DashboardLowStockProduct {
  id: string;
  name: string;
  slug: string;
  primaryImageUrl: string | null;
  availableStock: number;
}

export interface DashboardOrderStatusBreakdown {
  pending_payment: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  returned: number;
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  pendingPaymentCount: number;
  toFulfillCount: number;
  returnRequestedCount: number;
  refundPendingCount: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
  ordersChangePercent: number | null;
  revenueChangePercent: number | null;
  totalProducts: number;
  activeProducts: number;
  totalCustomers: number;
  newCustomersThisMonth: number;
  revenueTrend: { day: string; revenue: number }[];
  orderStatusBreakdown: DashboardOrderStatusBreakdown;
  topProducts: DashboardTopProduct[];
  lowStockProducts: DashboardLowStockProduct[];
}

export function fetchDashboardStats() {
  return apiFetch<DashboardStats>('/admin/dashboard/stats');
}
