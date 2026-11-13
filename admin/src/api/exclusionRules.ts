import { apiFetch } from './client';

export interface ExclusionRuleValue {
  id: string;
  attributeCode: string;
  attributeName: string;
  label: string;
}

export interface ExclusionRule {
  id: string;
  valueA: ExclusionRuleValue;
  valueB: ExclusionRuleValue;
}

export function fetchExclusionRules(productId: string) {
  return apiFetch<{ rules: ExclusionRule[] }>(`/admin/products/${productId}/exclusion-rules`);
}

export function createExclusionRule(productId: string, input: { attributeValueIdA: string; attributeValueIdB: string }) {
  return apiFetch<{ rule: ExclusionRule }>(`/admin/products/${productId}/exclusion-rules`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteExclusionRule(productId: string, ruleId: string) {
  return apiFetch<void>(`/admin/products/${productId}/exclusion-rules/${ruleId}`, {
    method: 'DELETE',
  });
}
