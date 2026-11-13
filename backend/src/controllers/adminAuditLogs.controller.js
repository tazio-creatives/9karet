import { z } from 'zod';
import { listAuditLogs } from '../repositories/auditLogs.repository.js';

const listQuerySchema = z.object({
  entity: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

function toAuditLogDto(row) {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    adminEmail: row.admin_email,
    adminFullName: row.admin_full_name,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    diff: row.diff,
    createdAt: row.created_at,
  };
}

export async function list(req, res, next) {
  try {
    const q = listQuerySchema.parse(req.query);
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const { items, total } = await listAuditLogs({ entity: q.entity, page, limit });
    res.json({
      logs: items.map(toAuditLogDto),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}
