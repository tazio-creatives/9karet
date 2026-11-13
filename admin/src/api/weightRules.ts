import { apiFetch } from './client';
import type { Purity } from './types';

export interface WeightRule {
  id: string;
  purity: Purity;
  purityLabel: string;
  sizeLabel: string | null;
  goldWeightGrams: number;
}

export interface ReplaceWeightRulesInput {
  purityRules: { purity: Purity; goldWeightGrams: number }[];
  puritySizeRules: { purity: Purity; sizeLabel: string; goldWeightGrams: number }[];
}

export function fetchWeightRules(productId: string) {
  return apiFetch<{ rules: WeightRule[] }>(`/admin/products/${productId}/weight-rules`);
}

export function replaceWeightRules(productId: string, input: ReplaceWeightRulesInput) {
  return apiFetch<{ rules: WeightRule[] }>(`/admin/products/${productId}/weight-rules`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
