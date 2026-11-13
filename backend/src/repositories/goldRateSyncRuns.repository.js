import { query } from '../config/db.js';

export async function insertGoldRateSyncRun(run) {
  const { rows } = await query(
    `INSERT INTO gold_rate_sync_runs (
       trigger, primary_provider, primary_status, primary_rate, primary_error,
       fallback_provider, fallback_status, fallback_rate, fallback_error,
       resolved_provider, base_rate_24k, adjustment_type, adjustment_value, effective_rate_24k,
       status, applied, rejected_reason, products_recalculated, duration_ms
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [
      run.trigger,
      run.primaryProvider,
      run.primaryStatus,
      run.primaryRate ?? null,
      run.primaryError ?? null,
      run.fallbackProvider ?? null,
      run.fallbackStatus ?? null,
      run.fallbackRate ?? null,
      run.fallbackError ?? null,
      run.resolvedProvider ?? null,
      run.baseRate24k ?? null,
      run.adjustmentType,
      run.adjustmentValue,
      run.effectiveRate24k ?? null,
      run.status,
      run.applied,
      run.rejectedReason ?? null,
      run.productsRecalculated ?? null,
      run.durationMs ?? null,
    ],
  );
  return rows[0];
}

export async function getLatestGoldRateSyncRun() {
  const { rows } = await query(`SELECT * FROM gold_rate_sync_runs ORDER BY created_at DESC LIMIT 1`);
  return rows[0] ?? null;
}

export async function listGoldRateSyncRuns({ page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await query(
    `SELECT * FROM gold_rate_sync_runs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const {
    rows: [{ count }],
  } = await query('SELECT COUNT(*)::int AS count FROM gold_rate_sync_runs');
  return { items: rows, total: count };
}
