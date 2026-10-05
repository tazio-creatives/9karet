import { getDashboardStats } from '../repositories/dashboard.repository.js';

// Guards a percent-change computation against a zero/undefined base — no
// "Infinity%" or NaN badge when last month had no orders/revenue to compare
// against. null tells the frontend to render "—" instead of a delta badge.
function percentChange(current, previous) {
  if (!previous) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getStats(req, res, next) {
  try {
    const stats = await getDashboardStats();
    const totalRevenue = Number(stats.total_revenue);
    const revenueThisMonth = Number(stats.revenue_this_month);
    const revenueLastMonth = Number(stats.revenue_last_month);
    const revenueOrderCount = stats.revenue_order_count;

    res.json({
      totalOrders: stats.total_orders,
      totalRevenue,
      averageOrderValue: revenueOrderCount > 0 ? Math.round(totalRevenue / revenueOrderCount) : 0,
      pendingPaymentCount: stats.pending_payment_count,
      toFulfillCount: stats.to_fulfill_count,
      returnRequestedCount: stats.return_requested_count,
      refundPendingCount: stats.refund_pending_count,
      ordersThisMonth: stats.orders_this_month,
      revenueThisMonth,
      ordersChangePercent: percentChange(stats.orders_this_month, stats.orders_last_month),
      revenueChangePercent: percentChange(revenueThisMonth, revenueLastMonth),
      totalProducts: stats.total_products,
      activeProducts: stats.active_products,
      totalCustomers: stats.total_customers,
      newCustomersThisMonth: stats.new_customers_this_month,
      revenueTrend: stats.revenueTrend.map((row) => ({
        day: row.day,
        revenue: Number(row.revenue),
      })),
      orderStatusBreakdown: stats.orderStatusBreakdown,
      topProducts: stats.topProducts.map((row) => ({
        productId: row.product_id,
        name: row.name,
        slug: row.slug,
        primaryImageUrl: row.primary_image_url,
        unitsSold: row.units_sold,
        revenue: Number(row.revenue),
      })),
      lowStockProducts: stats.lowStockProducts.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        primaryImageUrl: row.primary_image_url,
        availableStock: row.available_stock,
      })),
    });
  } catch (err) {
    next(err);
  }
}
