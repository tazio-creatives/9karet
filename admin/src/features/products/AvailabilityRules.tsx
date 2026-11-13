import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createExclusionRule, deleteExclusionRule, fetchExclusionRules, type ExclusionRule } from '../../api/exclusionRules';
import { fetchProductVariants } from '../../api/products';
import type { ProductAttributeGroup } from '../../api/types';
import styles from './ProductVariations.module.css';

interface AvailabilityRulesProps {
  productId: string;
  attributes: ProductAttributeGroup[];
}

// Per-product pairwise exclusions — "this product's Rose Gold isn't offered
// in 9K" — replacing the old single hardcoded, universal rule. Only shown in
// edit mode: a rule references attribute_values that must already exist on
// the product's saved axes, so there's nothing to build a rule from until
// after the first save.
export function AvailabilityRules({ productId, attributes }: AvailabilityRulesProps) {
  const queryClient = useQueryClient();
  const [valueA, setValueA] = useState('');
  const [valueB, setValueB] = useState('');

  const { data: rulesData } = useQuery({
    queryKey: ['admin-exclusion-rules', productId],
    queryFn: () => fetchExclusionRules(productId),
  });
  const { data: variantsData } = useQuery({
    queryKey: ['admin-product-variants', productId],
    queryFn: () => fetchProductVariants(productId),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['admin-exclusion-rules', productId] });
    queryClient.invalidateQueries({ queryKey: ['admin-product-variants', productId] });
    queryClient.invalidateQueries({ queryKey: ['admin-product', productId] });
  }

  const createMutation = useMutation({
    mutationFn: () => createExclusionRule(productId, { attributeValueIdA: valueA, attributeValueIdB: valueB }),
    onSuccess: () => {
      invalidateAll();
      setValueA('');
      setValueB('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => deleteExclusionRule(productId, ruleId),
    onSuccess: invalidateAll,
  });

  const flatValues = attributes.flatMap((attr) =>
    attr.values.map((v) => ({ id: v.id, label: v.label, attributeName: attr.name, attributeCode: attr.code })),
  );
  const valueAAttrCode = flatValues.find((v) => v.id === valueA)?.attributeCode;
  const valueBOptions = flatValues.filter((v) => v.attributeCode !== valueAAttrCode);

  function affectedCount(rule: ExclusionRule) {
    return (variantsData?.variants ?? []).filter(
      (v) => v.attributeValueIds.includes(rule.valueA.id) && v.attributeValueIds.includes(rule.valueB.id),
    ).length;
  }

  const rules = rulesData?.rules ?? [];

  if (flatValues.length < 2) return null;

  return (
    <div className={styles.rulesPanel}>
      <span className={styles.advancedTitle}>Availability Rules</span>
      <p className={styles.advancedSub} style={{ padding: 0, marginTop: 4 }}>
        Exclude combinations customers cannot purchase.
      </p>

      {rules.length === 0 ? (
        <p className={styles.emptyNote}>No rules yet — every selected combination is purchasable.</p>
      ) : (
        <ul className={styles.ruleList}>
          {rules.map((rule) => {
            const count = affectedCount(rule);
            return (
              <li key={rule.id} className={styles.ruleRow}>
                <span>
                  <strong>{rule.valueA.attributeName}: {rule.valueA.label}</strong> is not available with{' '}
                  <strong>{rule.valueB.attributeName}: {rule.valueB.label}</strong>
                  {count > 0 && (
                    <span className={styles.ruleCount}>
                      {' '}
                      — {count} combination{count === 1 ? '' : 's'} excluded
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className={styles.sizeRemoveBtn}
                  onClick={() => deleteMutation.mutate(rule.id)}
                  aria-label="Remove rule"
                  disabled={deleteMutation.isPending}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.ruleAddRow}>
        <select
          className={styles.ruleSelect}
          value={valueA}
          onChange={(e) => {
            setValueA(e.target.value);
            setValueB('');
          }}
        >
          <option value="">Select a value…</option>
          {flatValues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.attributeName}: {v.label}
            </option>
          ))}
        </select>
        <span>is not available with</span>
        <select
          className={styles.ruleSelect}
          value={valueB}
          onChange={(e) => setValueB(e.target.value)}
          disabled={!valueA}
        >
          <option value="">Select a value…</option>
          {valueBOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.attributeName}: {v.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.ruleAddBtn}
          disabled={!valueA || !valueB || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? 'Adding…' : '+ Add Rule'}
        </button>
      </div>
      {createMutation.isError && (
        <p className={styles.ruleCount}>{(createMutation.error as Error).message}</p>
      )}
    </div>
  );
}
