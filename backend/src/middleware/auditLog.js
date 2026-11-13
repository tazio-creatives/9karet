import { insertAuditLog } from '../repositories/auditLogs.repository.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID_RE = /^[0-9a-f-]{36}$/i;
const REDACTED_FIELDS = new Set(['password', 'newPassword', 'currentPassword']);

// Secrets must never land in the audit trail (plan §8/§13) even though the
// trail's whole purpose is to record what admins submitted.
function redact(body) {
  const clean = {};
  for (const [key, value] of Object.entries(body)) {
    clean[key] = REDACTED_FIELDS.has(key) ? '[redacted]' : value;
  }
  return clean;
}

// Generic admin-mutation logger (plan §3: "audit_logs ... for every admin
// mutation") — mounted once on the admin routers rather than instrumented
// per-controller, so no future admin endpoint can be added without being
// audited. Derives entity/entityId from the URL path under /api/v1/admin/
// instead of requiring each route to declare them.
//
// Path must be captured eagerly (before next()), not read inside the
// 'finish' callback — Express mutates req.url as it descends into each
// nested sub-router, and only restores it via the next() callback chain.
// A leaf handler that responds without calling next() (every controller
// here) means that restoration never happens, so req.path read later would
// reflect the innermost sub-router's stripped path, not the full one.
// req.originalUrl is set once per request and never mutated, so it's safe
// to read at any time — but path segments are captured now for clarity.
//
// Waits for the response to actually finish so only requests that succeeded
// (status < 400) get logged — a validation/auth rejection isn't a mutation.
export function auditLog(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const pathAfterAdminPrefix = req.originalUrl.split('?')[0].replace(/^\/api\/v1\/admin\/?/, '');
  const segments = pathAfterAdminPrefix.split('/').filter(Boolean);
  const entity = segments[0] ?? 'unknown';
  const entityId = segments[1] && UUID_RE.test(segments[1]) ? segments[1] : null;
  const body = req.body && Object.keys(req.body).length ? redact(req.body) : null;

  res.on('finish', () => {
    if (res.statusCode >= 400) return;

    insertAuditLog({
      adminUserId: req.admin?.id ?? null,
      action: req.method,
      entity,
      entityId,
      diff: body,
    }).catch((err) => console.error('Audit log write failed:', err));
  });

  next();
}
