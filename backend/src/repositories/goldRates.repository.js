import { query } from '../config/db.js';

export async function insertGoldRates(rates, source) {
  const values = [];
  const placeholders = rates.map(({ purity, ratePerGram }, i) => {
    values.push(purity, ratePerGram, source);
    const base = i * 3;
    return `($${base + 1}, $${base + 2}, $${base + 3})`;
  });

  const { rows } = await query(
    `INSERT INTO gold_rates (purity, rate_per_gram, source)
     VALUES ${placeholders.join(', ')}
     RETURNING id, purity, rate_per_gram, source, fetched_at`,
    values,
  );
  return rows;
}

export async function getCurrentGoldRate(purity) {
  const { rows } = await query(
    `SELECT id, purity, rate_per_gram, source, fetched_at
     FROM gold_rates WHERE purity = $1
     ORDER BY fetched_at DESC LIMIT 1`,
    [purity],
  );
  return rows[0] ?? null;
}

// Latest row per purity — for the admin "current rates" view.
export async function getCurrentGoldRates() {
  const { rows } = await query(
    `SELECT DISTINCT ON (purity) id, purity, rate_per_gram, source, fetched_at
     FROM gold_rates
     ORDER BY purity, fetched_at DESC`,
  );
  return rows;
}

export async function listGoldRateHistory({ page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await query(
    `SELECT id, purity, rate_per_gram, source, fetched_at
     FROM gold_rates ORDER BY fetched_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const {
    rows: [{ count }],
  } = await query('SELECT COUNT(*)::int AS count FROM gold_rates');
  return { items: rows, total: count };
}
