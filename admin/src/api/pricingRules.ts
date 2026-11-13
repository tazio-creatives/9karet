import { apiFetch } from './client';
import type {
  PricingRule,
  PricingRuleInput,
  PricingRuleStatus,
  PricingRuleScope,
  PricingRuleType,
  RulePreviewResult,
  RepriceJob,
  PricingAuditAction,
  PricingAuditEntry,
} from './types';

export interface FetchPricingRulesParams {
  ruleType?: PricingRuleType;
  status?: PricingRuleStatus;
  scope?: PricingRuleScope;
  search?: string;
  page?: number;
  limit?: number;
}

export function fetchPricingRules(params: FetchPricingRulesParams = {}) {
  const qs = new URLSearchParams();
  if (params.ruleType) qs.set('ruleType', params.ruleType);
  if (params.status) qs.set('status', params.status);
  if (params.scope) qs.set('scope', params.scope);
  if (params.search) qs.set('search', params.search);
  qs.set('page', String(params.page ?? 1));
  qs.set('limit', String(params.limit ?? 25));
  return apiFetch<{ rules: PricingRule[]; total: number; page: number; limit: number }>(
    `/admin/pricing/rules?${qs.toString()}`,
  );
}

export function fetchPricingRule(id: string) {
  return apiFetch<{ rule: PricingRule }>(`/admin/pricing/rules/${id}`);
}

export function createPricingRule(input: PricingRuleInput) {
  return apiFetch<{ rule: PricingRule }>('/admin/pricing/rules', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePricingRule(id: string, input: Partial<PricingRuleInput>) {
  return apiFetch<{ rule: PricingRule }>(`/admin/pricing/rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deletePricingRule(id: string) {
  return apiFetch<{ deleted: boolean; repriceJobId: string | null }>(`/admin/pricing/rules/${id}`, {
    method: 'DELETE',
  });
}

export function activatePricingRule(id: string) {
  return apiFetch<{ rule: PricingRule }>(`/admin/pricing/rules/${id}/activate`, { method: 'POST' });
}

export function disablePricingRule(id: string) {
  return apiFetch<{ rule: PricingRule }>(`/admin/pricing/rules/${id}/disable`, { method: 'POST' });
}

// Unsaved-payload preview — validated exactly like create, never persisted.
export function previewPricingRule(input: PricingRuleInput) {
  return apiFetch<RulePreviewResult>('/admin/pricing/rules/preview', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Re-simulates an already-saved rule (e.g. before manually re-triggering a reprice).
export function previewSavedPricingRule(id: string) {
  return apiFetch<RulePreviewResult>(`/admin/pricing/rules/${id}/preview`, { method: 'POST' });
}

export function triggerReprice(id: string) {
  return apiFetch<{ repriceJobId: string }>(`/admin/pricing/rules/${id}/reprice`, { method: 'POST' });
}

export function fetchRepriceJob(jobId: string) {
  return apiFetch<{ job: RepriceJob }>(`/admin/pricing/reprice-jobs/${jobId}`);
}

export function fetchActiveRepriceJobs() {
  return apiFetch<{ jobs: RepriceJob[] }>('/admin/pricing/reprice-jobs?active=true');
}

export interface FetchPricingAuditParams {
  ruleId?: string;
  productId?: string;
  action?: PricingAuditAction;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function fetchPricingAudit(params: FetchPricingAuditParams = {}) {
  const qs = new URLSearchParams();
  if (params.ruleId) qs.set('ruleId', params.ruleId);
  if (params.productId) qs.set('productId', params.productId);
  if (params.action) qs.set('action', params.action);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  qs.set('page', String(params.page ?? 1));
  qs.set('limit', String(params.limit ?? 50));
  return apiFetch<{ entries: PricingAuditEntry[]; total: number; page: number; limit: number }>(
    `/admin/pricing/audit?${qs.toString()}`,
  );
}
