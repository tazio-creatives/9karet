import { query } from '../config/db.js';

// productIds is written as a Postgres UUID[] literal via ANY-array binding
// (pg serializes a JS array param to an array literal automatically for an
// array-typed column). Relies on pricing_reprice_jobs_one_active (a partial
// unique index) to reject a duplicate in-flight job for the same rule (or
// the same rule-less slot) with a 23505 — the caller (pricingRuleService.js)
// translates that into a 409.
export async function enqueueRepriceJob({ ruleId = null, ruleNameSnapshot = null, trigger, productIds, requestedBy = null }) {
  const { rows } = await query(
    `INSERT INTO pricing_reprice_jobs (rule_id, rule_name_snapshot, trigger, product_ids, total_count, requested_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [ruleId, ruleNameSnapshot, trigger, productIds, productIds.length, requestedBy],
  );
  return rows[0];
}

// Atomic claim — only the first caller to reach this for a given QUEUED job
// gets a non-null row back, making the handler safe under pg-boss job
// redelivery (retryLimit is 0 for this queue, but a stuck/duplicate delivery
// is still possible at the infra level).
export async function claimRepriceJob(id) {
  const { rows } = await query(
    `UPDATE pricing_reprice_jobs
     SET status = 'RUNNING', started_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'QUEUED'
     RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
}

export async function bumpRepriceCounters(id, { processed = 0, changed = 0, failed = 0 }) {
  await query(
    `UPDATE pricing_reprice_jobs
     SET processed_count = processed_count + $2,
         changed_count = changed_count + $3,
         failed_count = failed_count + $4,
         updated_at = now()
     WHERE id = $1`,
    [id, processed, changed, failed],
  );
}

export async function finishRepriceJob(id, { status, failures = [], error = null }) {
  const { rows } = await query(
    `UPDATE pricing_reprice_jobs
     SET status = $2, failures = $3, error = $4, finished_at = now(), updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, status, JSON.stringify(failures), error],
  );
  return rows[0] ?? null;
}

export async function findRepriceJobById(id) {
  const { rows } = await query(`SELECT * FROM pricing_reprice_jobs WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findActiveRepriceJobs() {
  const { rows } = await query(
    `SELECT * FROM pricing_reprice_jobs WHERE status IN ('QUEUED', 'RUNNING') ORDER BY created_at DESC`,
  );
  return rows;
}

export async function findRecentRepriceJobs({ ruleId = null, limit = 20 } = {}) {
  if (ruleId) {
    const { rows } = await query(
      `SELECT * FROM pricing_reprice_jobs WHERE rule_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [ruleId, limit],
    );
    return rows;
  }
  const { rows } = await query(`SELECT * FROM pricing_reprice_jobs ORDER BY created_at DESC LIMIT $1`, [limit]);
  return rows;
}
