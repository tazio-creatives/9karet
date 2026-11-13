import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db.js';
import { env, isProduction } from './env.js';

const PgStore = connectPgSimple(session);

// Factory so customer sessions (Phase 3) can reuse this with their own table/
// cookie name — customer and admin sessions must never share storage. See plan §8.
export function createSessionMiddleware({ tableName, cookieName, secret, maxAgeHours }) {
  return session({
    store: new PgStore({ pool, tableName, createTableIfMissing: false }),
    name: cookieName,
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true, // sliding expiry
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      domain: env.cookieDomain,
      maxAge: maxAgeHours * 60 * 60 * 1000,
    },
  });
}
