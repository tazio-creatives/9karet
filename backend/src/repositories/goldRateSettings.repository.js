import { query } from '../config/db.js';

// Singleton row (enforced by the `singleton` UNIQUE column) — there is
// always exactly one, seeded by the migration, so a plain SELECT/UPDATE with
// no id needed is safe and simpler than threading a row id around.
export async function getGoldRateSettings() {
  const { rows } = await query(
    `SELECT id, source, adjustment_type, adjustment_value, max_deviation_percent, updated_at, updated_by_admin_id
     FROM gold_rate_settings LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function updateGoldRateSettings(fields, adminId) {
  const sets = [];
  const values = [];
  let i = 1;

  if (Object.hasOwn(fields, 'source')) {
    sets.push(`source = $${i++}`);
    values.push(fields.source);
  }
  if (Object.hasOwn(fields, 'adjustmentType')) {
    sets.push(`adjustment_type = $${i++}`);
    values.push(fields.adjustmentType);
  }
  if (Object.hasOwn(fields, 'adjustmentValue')) {
    sets.push(`adjustment_value = $${i++}`);
    values.push(fields.adjustmentValue);
  }
  if (Object.hasOwn(fields, 'maxDeviationPercent')) {
    sets.push(`max_deviation_percent = $${i++}`);
    values.push(fields.maxDeviationPercent);
  }
  sets.push(`updated_at = now()`, `updated_by_admin_id = $${i++}`);
  values.push(adminId ?? null);

  const { rows } = await query(
    `UPDATE gold_rate_settings SET ${sets.join(', ')}
     WHERE id = (SELECT id FROM gold_rate_settings LIMIT 1)
     RETURNING id, source, adjustment_type, adjustment_value, max_deviation_percent, updated_at, updated_by_admin_id`,
    values,
  );
  return rows[0];
}
