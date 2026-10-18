import { query } from '../config/db.js';

// Locks the product row for the duration of the checkout transaction (plan
// §11) — the SELECT ... FOR UPDATE is what makes the stock check+reserve
// atomic across concurrent checkouts. Callers must lock rows for a
// multi-item order in ascending product_id order to avoid deadlocks.
// The full row, not a column subset: checkout prices the line from it via
// computeVariantPricing, which needs every pricing input the cart used
// (making_charge_percent, the offer discount percents, category_id for
// category rules) — a narrower list silently charged a different price
// than the cart showed.
export async function lockProductForCheckoutTx(client, productId) {
  const { rows } = await client.query(
    `SELECT * FROM products WHERE id = $1 FOR UPDATE`,
    [productId],
  );
  return rows[0] ?? null;
}

// Row-level locks don't cascade — locking the product row above says nothing
// about a specific variant row underneath it, so every line also locks its
// own product_variants row before the stock check+reserve. Also resolves
// the variant's attribute values (same shape findVariantById returns) in a
// second query — computeVariantPricing's resolvedPurity/resolvedGoldColor/
// resolvedSizeLabel helpers need it, and it must reflect the
// just-locked row, not a stale pre-lock read.
export async function lockProductVariantForCheckoutTx(client, variantId) {
  const { rows } = await client.query(
    `SELECT id, product_id, gold_weight_grams, price_override,
            stock_quantity, is_available, combination_key
     FROM product_variants WHERE id = $1 FOR UPDATE`,
    [variantId],
  );
  const variant = rows[0];
  if (!variant) return null;

  const { rows: attrRows } = await client.query(
    `SELECT
       COALESCE(
         json_object_agg(a.code, jsonb_build_object('valueId', av.id, 'value', av.value, 'label', av.label, 'refId', av.ref_id))
           FILTER (WHERE a.code IS NOT NULL),
         '{}'::json
       ) AS attributes
     FROM variant_attribute_values vav
     JOIN attribute_values av ON av.id = vav.attribute_value_id
     JOIN attributes a ON a.id = av.attribute_id
     WHERE vav.variant_id = $1`,
    [variantId],
  );
  variant.attributes = attrRows[0]?.attributes ?? {};
  return variant;
}

const ORDER_COLUMNS = [
  'order_number',
  'user_id',
  'status',
  'contact_name',
  'contact_mobile',
  'contact_email',
  'shipping_address',
  'subtotal',
  'discount_amount',
  'gst_amount',
  'shipping_amount',
  'total_amount',
  'coupon_id',
  'coupon_code',
  'delivery_note',
  'estimated_delivery_start_date',
  'estimated_delivery_end_date',
  'delivery_minimum_days',
  'delivery_maximum_days',
];

const ORDER_FIELD_MAP = Object.fromEntries(
  ORDER_COLUMNS.map((column) => [column.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), column]),
);

export async function insertOrderTx(client, fields) {
  const columns = [];
  const placeholders = [];
  const values = [];
  for (const [key, column] of Object.entries(ORDER_FIELD_MAP)) {
    if (Object.hasOwn(fields, key)) {
      values.push(column === 'shipping_address' ? JSON.stringify(fields[key]) : fields[key]);
      columns.push(column);
      placeholders.push(column === 'shipping_address' ? `$${values.length}::jsonb` : `$${values.length}`);
    }
  }
  const { rows } = await client.query(
    `INSERT INTO orders (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values,
  );
  return rows[0];
}

export async function insertOrderItemTx(client, fields) {
  const { rows } = await client.query(
    `INSERT INTO order_items
       (order_id, product_id, product_variant_id, variant_attributes_snapshot,
        product_name, product_sku, quantity,
        gold_value, stone_value, making_charge, gst_amount, unit_price, line_total, gold_rate_id,
        is_backordered, gold_weight_grams_snapshot, stones_snapshot, customization_note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING *`,
    [
      fields.orderId,
      fields.productId,
      fields.productVariantId ?? null,
      JSON.stringify(fields.variantAttributesSnapshot ?? []),
      fields.productName,
      fields.productSku,
      fields.quantity,
      fields.goldValue,
      fields.stoneValue,
      fields.makingCharge,
      fields.gstAmount,
      fields.unitPrice,
      fields.lineTotal,
      fields.goldRateId ?? null,
      fields.isBackordered ?? false,
      fields.goldWeightGramsSnapshot ?? null,
      JSON.stringify(fields.stonesSnapshot ?? []),
      fields.customizationNote ?? null,
    ],
  );
  return rows[0];
}

// `actor` is an admin_users.id (or null for system/webhook-driven changes) and
// `source` is one of ADMIN/PAYMENT_GATEWAY/DELHIVERY/SYSTEM — see the
// 20260918000000 migration. Every call site was updated to pass these; none
// silently default to an unattributed history row anymore.
export async function insertOrderStatusHistoryTx(client, orderId, status, note = null, { actor = null, source = 'SYSTEM' } = {}) {
  await client.query(
    'INSERT INTO order_status_history (order_id, status, note, actor_admin_user_id, source) VALUES ($1, $2, $3, $4, $5)',
    [orderId, status, note, actor, source],
  );
}

// Duplicate-notification guard (spec: "do not send multiple notifications
// for the same status") — call before inserting the new history row for a
// transition, so "has this status ever been recorded for this order
// before" reflects the state prior to the change being made right now.
export async function hasOrderStatusHistoryEntry(orderId, status) {
  const { rows } = await query(
    'SELECT 1 FROM order_status_history WHERE order_id = $1 AND status = $2 LIMIT 1',
    [orderId, status],
  );
  return rows.length > 0;
}

export async function updateOrderStatusTx(client, orderId, status) {
  const { rows } = await client.query(
    'UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING *',
    [orderId, status],
  );
  return rows[0] ?? null;
}

// Partial update of the three new split-status fields — only the fields
// present in `fields` are written, so a caller that only knows about
// payment_status (e.g. the payment webhook) never has to also restate the
// current order_status/shipment_status just to avoid clobbering them.
const STATUS_FIELD_COLUMNS = {
  paymentStatus: 'payment_status',
  orderStatus: 'order_status',
  shipmentStatus: 'shipment_status',
};

export async function updateOrderStatusFieldsTx(client, orderId, fields) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(STATUS_FIELD_COLUMNS)) {
    if (Object.hasOwn(fields, key)) {
      values.push(fields[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (sets.length === 0) return null;
  values.push(orderId);
  const { rows } = await client.query(
    `UPDATE orders SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0] ?? null;
}

// Atomic compare-and-swap, not a read-then-write — the reservation sweep
// (plan §11 2b) races against the payment webhook by design (both can run
// for the same order at nearly the same moment), so the WHERE status =
// 'PENDING_PAYMENT' guard is what stops a just-CONFIRMED order from ever
// being clobbered back to EXPIRED.
export async function expireOrderIfPendingTx(client, orderId) {
  const { rows } = await client.query(
    `UPDATE orders SET status = 'EXPIRED', updated_at = now()
     WHERE id = $1 AND status = 'PENDING_PAYMENT' RETURNING *`,
    [orderId],
  );
  return rows[0] ?? null;
}

// Meta Conversions API identifiers captured at checkout (see metaCapiService).
export async function saveOrderMetaAttribution(orderId, attribution) {
  await query('UPDATE orders SET meta_attribution = $2::jsonb WHERE id = $1', [orderId, JSON.stringify(attribution)]);
}

export async function findOrderById(id) {
  const { rows } = await query('SELECT * FROM orders WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function findOrderByIdTx(client, id) {
  const { rows } = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Row-locked read for state transitions that must not race each other (e.g.
// a customer cancelling at the same moment an admin starts processing).
export async function findOrderByIdForUpdateTx(client, id) {
  const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] ?? null;
}

// The admin/customer order-list filter dropdown offers one flat list of
// "statuses" (see utils/orderStatus.js's STATUS_FILTER_VALUES) that spans
// two real columns — PENDING_PAYMENT/PAYMENT_FAILED are payment_status
// states with order_status still NULL, everything else is a real
// order_status value. Mutates `params` (pushes onto it) and returns the
// clause referencing the resulting placeholder, or null if no filter.
function statusFilterClause(status, params) {
  if (!status) return null;
  if (status === 'PENDING_PAYMENT' || status === 'PAYMENT_FAILED') {
    params.push(status === 'PENDING_PAYMENT' ? 'PENDING' : 'FAILED');
    return `payment_status = $${params.length} AND order_status IS NULL`;
  }
  if (status === 'REFUND_PENDING') {
    return `order_status IN ('CANCELLED', 'RETURNED') AND payment_status = 'PAID'`;
  }
  params.push(status);
  return `order_status = $${params.length}`;
}

// Admin order directory (plan §5 /orders, /orders/:id) — every order, not
// scoped to a single customer. `search` matches order number (what the work
// order's barcode encodes) or contact mobile — covers both "type the order
// number in" and "scan the barcode" (a scanner just keystrokes the decoded
// value into the search box) without needing any barcode-specific backend
// logic, since the barcode IS the order number.
export async function findAllOrders({ status, search, page = 1, limit = 20 } = {}) {
  const clauses = [];
  const params = [];
  const statusClause = statusFilterClause(status, params);
  if (statusClause) clauses.push(statusClause);
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(order_number ILIKE $${params.length} OR contact_mobile ILIKE $${params.length})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const listParams = [...params, limit, offset];

  const { rows } = await query(
    `SELECT o.*, items.first_product_name, items.item_count
     FROM orders o
     LEFT JOIN LATERAL (
       SELECT
         (array_agg(product_name ORDER BY created_at))[1] AS first_product_name,
         COUNT(*)::int AS item_count
       FROM order_items
       WHERE order_id = o.id
     ) items ON true
     ${where}
     ORDER BY o.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  const {
    rows: [{ count }],
  } = await query(`SELECT COUNT(*)::int AS count FROM orders ${where}`, params);

  return { items: rows, total: count };
}

// "Active" = still moving toward delivery, not a terminal state. Spend
// excludes orders that never actually resulted in a charge (unpaid/failed/
// expired/cancelled before confirmation) — a single aggregate query rather
// than summing a paginated page, since "Total Spent" must reflect every
// order the customer has ever placed, not just the current page of 10.
const ACTIVE_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'RETURN_REQUESTED'];
const UNSPENT_STATUSES = ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'EXPIRED', 'CANCELLED'];

export async function getOrderStatsForUser(userId) {
  const { rows } = await query(
    `SELECT
       COUNT(*)::int AS total_orders,
       COUNT(*) FILTER (WHERE status = ANY($2))::int AS active_orders,
       COALESCE(SUM(total_amount) FILTER (WHERE status != ALL($3)), 0) AS total_spent
     FROM orders WHERE user_id = $1`,
    [userId, ACTIVE_STATUSES, UNSPENT_STATUSES],
  );
  return rows[0];
}

export async function findOrdersByUser(userId, { status, page = 1, limit = 10 } = {}) {
  const clauses = ['user_id = $1'];
  const params = [userId];
  const statusClause = statusFilterClause(status, params);
  if (statusClause) clauses.push(statusClause);
  const where = `WHERE ${clauses.join(' AND ')}`;
  const offset = (page - 1) * limit;
  const listParams = [...params, limit, offset];

  const { rows } = await query(
    `SELECT * FROM orders ${where}
     ORDER BY created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  const {
    rows: [{ count }],
  } = await query(`SELECT COUNT(*)::int AS count FROM orders ${where}`, params);

  return { items: rows, total: count };
}

// Batched (not N+1) preview data for the account "My Orders" list card —
// item count, a representative product name/thumbnail, and the timestamps
// the order-progress stepper needs. Three queries total regardless of how
// many orders are on the page, since the page itself is already limited to
// a handful of rows.
export async function findOrderListExtras(orderIds) {
  if (orderIds.length === 0) {
    return { itemCounts: new Map(), previews: new Map(), milestones: new Map() };
  }

  const [{ rows: countRows }, { rows: previewRows }, { rows: milestoneRows }] = await Promise.all([
    query('SELECT order_id, COUNT(*)::int AS item_count FROM order_items WHERE order_id = ANY($1) GROUP BY order_id', [
      orderIds,
    ]),
    query(
      `SELECT DISTINCT ON (oi.order_id) oi.order_id, oi.product_name, pi.url AS preview_image_url
       FROM order_items oi
       LEFT JOIN LATERAL (
         SELECT url FROM product_images
         WHERE product_id = oi.product_id AND is_primary = true AND variant = 'small'
         LIMIT 1
       ) pi ON true
       WHERE oi.order_id = ANY($1)
       ORDER BY oi.order_id, oi.created_at ASC`,
      [orderIds],
    ),
    query(
      `SELECT order_id, status, MIN(created_at) AS at
       FROM order_status_history
       WHERE order_id = ANY($1) AND status IN (
         'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'
       )
       GROUP BY order_id, status`,
      [orderIds],
    ),
  ]);

  const itemCounts = new Map(countRows.map((r) => [r.order_id, r.item_count]));
  const previews = new Map(
    previewRows.map((r) => [r.order_id, { productName: r.product_name, imageUrl: r.preview_image_url }]),
  );
  const milestones = new Map();
  for (const row of milestoneRows) {
    const entry = milestones.get(row.order_id) ?? {};
    entry[row.status] = row.at;
    milestones.set(row.order_id, entry);
  }

  return { itemCounts, previews, milestones };
}

// Sales summary card on the admin Orders page — mirrors dashboard.repository.js's
// revenue convention (UNSPENT_STATUSES excluded from revenue/AOV so a cart that
// never got paid doesn't inflate "sales"). Unfiltered by default; an optional
// status filter lets the card reflect the same status the list is currently
// filtered to.
const UNSPENT_ORDER_STATUSES = ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'EXPIRED', 'CANCELLED'];

export async function getOrderSummaryStats({ status } = {}) {
  const params = [UNSPENT_ORDER_STATUSES];
  const filterClause = statusFilterClause(status, params);
  const statusClause = filterClause ? `AND ${filterClause}` : '';
  const { rows } = await query(
    `SELECT
       COUNT(*)::int AS total_orders,
       COALESCE(SUM(total_amount) FILTER (WHERE status != ALL($1)), 0) AS total_revenue,
       COUNT(*) FILTER (WHERE status != ALL($1))::int AS revenue_order_count,
       COUNT(*) FILTER (WHERE status IN ('CONFIRMED', 'PROCESSING'))::int AS to_fulfil_count,
       COUNT(*) FILTER (WHERE created_at >= current_date)::int AS orders_today
     FROM orders
     WHERE true ${statusClause}`,
    params,
  );
  return rows[0];
}

// Order detail page/panel item rows (admin + customer). Joins today's
// primary product image (thumbnail + a larger size for the hover preview) —
// a deliberate live lookup, since there's no requirement the thumbnail stay
// pinned to whatever existed at order time, and it can be null (no photo
// uploaded). The stones a piece was sold with come from the line's own
// stones_snapshot, never a live join. category_name is always a live join
// (products.category_id -> categories.name) — no snapshot needed since the
// work order (the one consumer that needs it) only cares about the
// product's current category, not a historical one.
// metal_type/net_weight_grams/gross_weight_grams/stone_weight_carats
// (admin "Product Details" panel, mirrors the storefront PDP's AttributesList)
// are always a live join too — these aren't per-variant fields in this schema
// (the PDP itself reads them straight off the product, no live-variant
// override), so there's nothing checkout-time to snapshot.
export async function findOrderItems(orderId) {
  const { rows } = await query(
    `SELECT oi.*, c.name AS category_name,
            p.metal_type, p.net_weight_grams, p.gross_weight_grams, p.stone_weight_carats,
            thumb.url AS product_image_url, large.url AS product_image_large_url
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN LATERAL (
       SELECT url FROM product_images
       WHERE product_id = oi.product_id AND is_primary = true AND variant = 'small'
       LIMIT 1
     ) thumb ON true
     LEFT JOIN LATERAL (
       SELECT url FROM product_images
       WHERE product_id = oi.product_id AND is_primary = true AND variant = 'large'
       LIMIT 1
     ) large ON true
     WHERE oi.order_id = $1
     ORDER BY oi.created_at`,
    [orderId],
  );
  return rows;
}

export async function findOrderItemById(id) {
  const { rows } = await query('SELECT * FROM order_items WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Customer-facing — no actor name (see the ADMIN-only join below); source
// stays in the row regardless since it's not sensitive on its own, just
// unused by the customer DTO.
export async function findOrderStatusHistory(orderId) {
  const { rows } = await query(
    'SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at',
    [orderId],
  );
  return rows;
}

// Admin-facing — adds the acting admin's name, per the spec's "employee
// assignments" stay admin-only requirement (customers get findOrderStatusHistory above).
export async function findOrderStatusHistoryForAdmin(orderId) {
  const { rows } = await query(
    `SELECT h.*, a.full_name AS actor_name
     FROM order_status_history h
     LEFT JOIN admin_users a ON a.id = h.actor_admin_user_id
     WHERE h.order_id = $1
     ORDER BY h.created_at`,
    [orderId],
  );
  return rows;
}

// Orders whose payment was confirmed after `since` — drives the admin
// "new order" alert (bell + ringtone). Uses the gateway's own CONFIRMED
// history row, so it fires once per paid order, not on later admin edits.
// `cursor` is an opaque timestamp string issued by the database itself
// (microsecond precision) — a JS Date would round to milliseconds and make
// the last order look "new" again on the next poll.
export async function findOrdersPaidSince(cursor, limit = 20) {
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.total_amount, o.contact_name, h.created_at AS confirmed_at,
            h.created_at::text AS cursor
     FROM order_status_history h
     JOIN orders o ON o.id = h.order_id
     WHERE h.status = 'CONFIRMED' AND h.source = 'PAYMENT_GATEWAY' AND h.created_at > $1::timestamptz
     ORDER BY h.created_at ASC
     LIMIT $2`,
    [cursor, limit],
  );
  return rows;
}

export async function currentDbTimestamp() {
  const { rows } = await query('SELECT now()::text AS now');
  return rows[0].now;
}
