import { apiFetch } from './client';
import type { AuditLogEntry } from './types';

export interface AuditLogListResponse {
  logs: AuditLogEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function fetchAuditLogs(entity?: string, page = 1, limit = 50) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (entity) qs.set('entity', entity);
  return apiFetch<AuditLogListResponse>(`/admin/audit-logs?${qs.toString()}`);
}
