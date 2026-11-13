import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from './env.js';

// DATE columns (OID 1082 — currently only orders.estimated_delivery_
// start_date/end_date) default to being parsed into a JS Date at local
// midnight, which silently shifts by a day once serialized to JSON/ISO if
// the server process's timezone isn't UTC. Returning the raw 'YYYY-MM-DD'
// string Postgres already sends avoids that reinterpretation entirely —
// exactly the date-only, no-implicit-timezone contract the delivery
// estimate snapshot depends on.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

// Ambient transaction context — lets the plain `query()` used throughout the
// repositories transparently participate in a withTransaction() block
// without every function in the call chain needing a `client` parameter
// threaded through it. Existing code that takes `client` explicitly
// (checkout's *Tx functions, which call client.query directly) is
// unaffected — this only changes what the bare `query()` helper resolves to.
const txContext = new AsyncLocalStorage();

// pg emits 'error' on the pool when an *idle* client's connection is reset
// by Postgres (network blip, managed-DB idle-connection reap) — with no
// listener, Node treats that as an uncaught exception and crashes the whole
// process, dropping every in-flight request (including unrelated ones, e.g.
// admin login) with a raw connection-reset error instead of a normal 500.
pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

export function query(text, params) {
  const client = txContext.getStore();
  return (client ?? pool).query(text, params);
}

// Runs `fn` inside a transaction, passing a dedicated client (needed for
// SELECT ... FOR UPDATE row locking — see plan §11 concurrency-safe
// reservations). Commits on success, rolls back and rethrows on any error.
// Also arms the ambient context above for the duration of `fn`, so any
// plain query() call anywhere in that call stack — not just calls made
// directly on the passed `client` — runs on this same connection/
// transaction.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await txContext.run(client, () => fn(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
