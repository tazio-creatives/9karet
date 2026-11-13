import { query } from '../config/db.js';

// The only writer of DELETEs against page_cache from the backend side —
// web/server owns the read/insert-on-miss path with its own connection
// (plan §1a: "web/server gets its own narrow Postgres connection ...
// nothing else"). Both processes share the same table by design.
export async function invalidatePageCache(urls) {
  const uniqueUrls = [...new Set(urls)].filter(Boolean);
  if (uniqueUrls.length === 0) return;
  await query('DELETE FROM page_cache WHERE url = ANY($1)', [uniqueUrls]);
}

// Prefix variant for sections whose cached URLs include query strings
// (e.g. /blog?page=2) — exact-URL matching would miss those.
export async function invalidatePageCacheByPrefix(prefix) {
  await query("DELETE FROM page_cache WHERE url = $1 OR url LIKE $2 OR url LIKE $3", [
    prefix,
    `${prefix}/%`,
    `${prefix}?%`,
  ]);
}
