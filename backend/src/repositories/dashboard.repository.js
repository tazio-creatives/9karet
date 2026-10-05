import { query } from '../config/db.js';
import { AVAILABLE_STOCK_JOIN, AVAILABLE_STOCK_SELECT, PRIMARY_IMAGE_JOIN } from './products.repository.js';

// Orders that never resulted in a real charge — excluded from revenue, same
// definition already used for a customer's "Total Spent" (orders.repository.js).
const UNSPENT_STATUSES = ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'EXPIRED', 'CANCELLED'];

// Low-stock threshold — a published product with 3 or fewer units available
// across its variants is worth an admin's attention before it sells out.
const LOW_STOCK_THRESHOLD = 3;

export async function getDashboardStats() {
  const [orderStats, productStats, customerStats, revenueTrend, statusBreakdown, topProducts, lowStockProducts] =
    await Promise.all([
      query(
        `SELECT
           COUNT(*)::int AS total_orders,
           COALESCE(SUM(total_amount) FILTER (WHERE status != ALL($1)), 0) AS total_revenue,
           COUNT(*) FILTER (WHERE status != ALL($1))::int AS revenue_order_count,
           COUNT(*) FILTER (WHERE status = 'PENDING_PAYMENT')::int AS pending_payment_count,
           COUNT(*) FILTER (WHERE status IN ('CONFIRMED', 'PROCESSING'))::int AS to_fulfill_count,
           COUNT(*) FILTER (WHERE order_status = 'RETURN_INITIATED')::int AS return_requested_count,
           COUNT(*) FILTER (
             WHERE order_status IN ('CANCELLED', 'RETURNED') AND payment_status = 'PAID'
           )::int AS refund_pending_count,
           COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS orders_this_month,
           COALESCE(
             SUM(total_amount) FILTER (WHERE status != ALL($1) AND created_at >= date_trunc('month', now())),
             0
           ) AS revenue_this_month,
           COUNT(*) FILTER (
             WHERE created_at >= date_trunc('month', now() - INTERVAL '1 month')
               AND created_at < date_trunc('month', now())
           )::int AS orders_last_month,
           COALESCE(
             SUM(total_amount) FILTER (
               WHERE status != ALL($1)
                 AND created_at >= date_trunc('month', now() - INTERVAL '1 month')
                 AND created_at < date_trunc('month', now())
             ),
             0
           ) AS revenue_last_month
         FROM orders`,
        [UNSPENT_STATUSES],
      ),
      // 'ACTIVE' isn't a real products.status value (the enum is DRAFT,
      // AI_PROCESSING, AI_READY, PUBLISHED, FAILED) — this previously always
      // counted zero active products.
      query(
        `SELECT
           COUNT(*)::int AS total_products,
           COUNT(*) FILTER (WHERE status = 'PUBLISHED')::int AS active_products
         FROM products`,
      ),
      query(
        `SELECT
           COUNT(*)::int AS total_customers,
           COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS new_customers_this_month
         FROM users`,
      ),
      // Last 30 days of revenue, one row per day (zero-filled) — powers the
      // dashboard's trend chart without the client doing date math.
      query(
        `SELECT day::date AS day, COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS day
         LEFT JOIN orders o
           ON o.created_at::date = day AND o.status != ALL($1)
         GROUP BY day
         ORDER BY day`,
        [UNSPENT_STATUSES],
      ),
      // Order lifecycle collapsed into 6 stages an admin actually scans for,
      // rather than the raw 11-value status enum.
      query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'PENDING_PAYMENT')::int AS pending_payment,
           COUNT(*) FILTER (WHERE status IN ('CONFIRMED', 'PROCESSING'))::int AS processing,
           COUNT(*) FILTER (WHERE status IN ('SHIPPED', 'OUT_FOR_DELIVERY'))::int AS shipped,
           COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS delivered,
           COUNT(*) FILTER (WHERE status IN ('CANCELLED', 'PAYMENT_FAILED', 'EXPIRED'))::int AS cancelled,
           COUNT(*) FILTER (WHERE status IN ('RETURN_REQUESTED', 'REFUNDED'))::int AS returned
         FROM orders`,
      ),
      // Top 5 products by revenue across non-unspent orders — order_items
      // snapshots product_name at order time, so this reads real historical
      // sales even if a product was later renamed or unpublished.
      query(
        `SELECT
           oi.product_id,
           MAX(oi.product_name) AS name,
           p.slug,
           MAX(primary_image.url) AS primary_image_url,
           SUM(oi.quantity)::int AS units_sold,
           SUM(oi.line_total) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN products p ON p.id = oi.product_id
         LEFT JOIN LATERAL (
           SELECT url FROM product_images
           WHERE product_id = oi.product_id AND is_primary = true AND variant = 'small'
           LIMIT 1
         ) primary_image ON true
         WHERE o.status != ALL($1)
         GROUP BY oi.product_id, p.slug
         ORDER BY revenue DESC
         LIMIT 5`,
        [UNSPENT_STATUSES],
      ),
      // Published products running low on available stock (see
      // products.repository.js's AVAILABLE_STOCK_JOIN for how "available" is
      // computed — sum of variant stock minus active reservations).
      query(
        `SELECT p.id, p.name, p.slug, primary_image.url AS primary_image_url, ${AVAILABLE_STOCK_SELECT}
         FROM products p
         ${PRIMARY_IMAGE_JOIN}
         ${AVAILABLE_STOCK_JOIN}
         WHERE p.status = 'PUBLISHED' AND variant_stock.available <= $1
         ORDER BY variant_stock.available ASC, p.name ASC
         LIMIT 8`,
        [LOW_STOCK_THRESHOLD],
      ),
    ]);

  return {
    ...orderStats.rows[0],
    ...productStats.rows[0],
    ...customerStats.rows[0],
    revenueTrend: revenueTrend.rows,
    orderStatusBreakdown: statusBreakdown.rows[0],
    topProducts: topProducts.rows,
    lowStockProducts: lowStockProducts.rows,
  };
}
