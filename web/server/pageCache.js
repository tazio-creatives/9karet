import pg from 'pg';

const { Pool } = pg;

// web/server's own narrow Postgres connection (plan §1a) — this module is
// the only thing in the process that touches the database, and the only
// table it ever queries is page_cache. Reads + writes-on-miss happen here;
// backend owns all DELETEs (invalidation) via its own connection.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ttlSeconds = Number(process.env.SSR_CACHE_TTL_SECONDS ?? 600);

export async function getCachedPage(url) {
  const { rows } = await pool.query(
    `SELECT html FROM page_cache
     WHERE url = $1 AND generated_at > now() - ($2 || ' seconds')::interval`,
    [url, ttlSeconds],
  );
  return rows[0]?.html ?? null;
}

export async function savePage(url, html) {
  await pool.query(
    `INSERT INTO page_cache (url, html, generated_at) VALUES ($1, $2, now())
     ON CONFLICT (url) DO UPDATE SET html = EXCLUDED.html, generated_at = now()`,
    [url, html],
  );
}
