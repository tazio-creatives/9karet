import { query } from '../config/db.js';

// Permanent, rule-independent audit trail (see the pricing_rule_audit_logs
// migration for why this is separate from the generic audit_logs table).
// Not called anywhere yet in Phase 1 (no rule mutations exist), but shipped
// now so Phase 2's job/service layer has a stable, already-verified insert
// point to call into.
export async function insertPricingRuleAuditLog({
  ruleId = null,
  ruleNameSnapshot,
  ruleType = null,
  action,
  previousValue = null,
  newValue = null,
  affectedProductCount = null,
  productId = null,
  adminUserId = null,
  adminEmailSnapshot = null,
}) {
  const { rows } = await query(
    `INSERT INTO pricing_rule_audit_logs
       (rule_id, rule_name_snapshot, rule_type, action, previous_value, new_value,
        affected_product_count, product_id, admin_user_id, admin_email_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, created_at`,
    [
      ruleId,
      ruleNameSnapshot,
      ruleType,
      action,
      previousValue == null ? null : JSON.stringify(previousValue),
      newValue == null ? null : JSON.stringify(newValue),
      affectedProductCount,
      productId,
      adminUserId,
      adminEmailSnapshot,
    ],
  );
  return rows[0];
}

export async function findPricingRuleAuditLogs({ ruleId, action, adminUserId, productId, from, to, page = 1, limit = 50 } = {}) {
  const clauses = [];
  const params = [];
  if (ruleId) {
    params.push(ruleId);
    clauses.push(`pal.rule_id = $${params.length}`);
  }
  if (action) {
    params.push(action);
    clauses.push(`pal.action = $${params.length}`);
  }
  if (adminUserId) {
    params.push(adminUserId);
    clauses.push(`pal.admin_user_id = $${params.length}`);
  }
  if (productId) {
    params.push(productId);
    clauses.push(`pal.product_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    clauses.push(`pal.created_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`pal.created_at <= $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const listParams = [...params, limit, offset];
  // LEFT JOIN admin_users for display only — admin_user_id is ON DELETE SET
  // NULL, so a since-removed admin still shows via admin_email_snapshot
  // (captured at write time) rather than disappearing from the trail.
  const { rows } = await query(
    `SELECT pal.*, au.full_name AS admin_full_name, p.name AS product_name, p.sku AS product_sku
     FROM pricing_rule_audit_logs pal
     LEFT JOIN admin_users au ON au.id = pal.admin_user_id
     LEFT JOIN products p ON p.id = pal.product_id
     ${where}
     ORDER BY pal.created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );
  const {
    rows: [{ count }],
  } = await query(`SELECT COUNT(*)::int AS count FROM pricing_rule_audit_logs pal ${where}`, params);
  return { items: rows, total: count };
}

// Most recent OVERRIDE_REMOVED/BULK_OVERRIDE_ACTION row for one product —
// the source of truth for the Restore Previous Overrides action (Phase 5).
export async function findLatestOverrideRemovalLog(productId) {
  const { rows } = await query(
    `SELECT * FROM pricing_rule_audit_logs
     WHERE product_id = $1 AND action IN ('OVERRIDE_REMOVED', 'BULK_OVERRIDE_ACTION')
     ORDER BY created_at DESC LIMIT 1`,
    [productId],
  );
  return rows[0] ?? null;
}
