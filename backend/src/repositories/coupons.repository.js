import { query } from '../config/db.js';

const COUPON_FIELD_MAP = {
  discountType: 'discount_type',
  discountValue: 'discount_value',
  minOrderValue: 'min_order_value',
  usageLimitTotal: 'usage_limit_total',
  usageLimitPerUser: 'usage_limit_per_user',
  startsAt: 'starts_at',
  expiresAt: 'expires_at',
  isActive: 'is_active',
};

export async function insertCoupon({
  code,
  discountType,
  discountValue,
  minOrderValue,
  usageLimitTotal,
  usageLimitPerUser,
  startsAt,
  expiresAt,
  isActive,
}) {
  const { rows: [row] } = await query(
    `INSERT INTO coupons
       (code, discount_type, discount_value, min_order_value, usage_limit_total,
        usage_limit_per_user, starts_at, expires_at, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      code,
      discountType,
      discountValue,
      minOrderValue ?? 0,
      usageLimitTotal ?? null,
      usageLimitPerUser ?? 1,
      startsAt ?? null,
      expiresAt ?? null,
      isActive ?? true,
    ],
  );
  return row;
}

// Dynamic UPDATE via Object.hasOwn (never COALESCE — see products.repository.js
// for why: undefined and null must be distinguishable, COALESCE collapses both).
export async function updateCoupon(id, fields) {
  const values = [id];
  const setClauses = [];
  for (const [key, column] of Object.entries(COUPON_FIELD_MAP)) {
    if (Object.hasOwn(fields, key)) {
      values.push(fields[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }
  if (setClauses.length === 0) return findCouponById(id);

  await query(`UPDATE coupons SET ${setClauses.join(', ')} WHERE id = $1`, values);
  return findCouponById(id);
}

export async function findCouponById(id) {
  const { rows } = await query('SELECT * FROM coupons WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function findCouponByCode(code) {
  const { rows } = await query('SELECT * FROM coupons WHERE code = $1', [code]);
  return rows[0] ?? null;
}

export async function listCoupons({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await query(
    `SELECT * FROM coupons ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const {
    rows: [{ count }],
  } = await query('SELECT COUNT(*)::int AS count FROM coupons');
  return { items: rows, total: count };
}

export async function countCouponUsageTotal(couponId) {
  const {
    rows: [{ count }],
  } = await query('SELECT COUNT(*)::int AS count FROM coupon_usage WHERE coupon_id = $1', [couponId]);
  return count;
}

export async function countCouponUsageForUser(couponId, userId) {
  const {
    rows: [{ count }],
  } = await query(
    'SELECT COUNT(*)::int AS count FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2',
    [couponId, userId],
  );
  return count;
}

// Called from the payment webhook only (plan §11: "coupon now actually
// consumed" — never at checkout time). ON CONFLICT DO NOTHING makes a
// repeat webhook delivery for the same order a safe no-op, same idempotency
// discipline as the payment/shipment tables themselves.
export async function insertCouponUsageTx(client, { couponId, userId, orderId }) {
  await client.query(
    `INSERT INTO coupon_usage (coupon_id, user_id, order_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (coupon_id, order_id) DO NOTHING`,
    [couponId, userId, orderId],
  );
}
