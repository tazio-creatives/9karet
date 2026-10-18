import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPricingRules,
  activatePricingRule,
  disablePricingRule,
  deletePricingRule,
} from '../../api/pricingRules';
import type { PricingRule, PricingRuleType } from '../../api/types';
import { ApiError } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import sharedStyles from '../../styles/shared.module.css';
import styles from './pricing.module.css';

interface PricingRulesListPageProps {
  ruleType: PricingRuleType;
}

const STATUS_BADGE: Record<PricingRule['status'], string> = {
  DRAFT: sharedStyles.badgeNeutral,
  SCHEDULED: sharedStyles.badgeInfo,
  ACTIVE: sharedStyles.badgeSuccess,
  EXPIRED: sharedStyles.badgeNeutral,
  DISABLED: sharedStyles.badgeWarning,
};

const SCOPE_LABEL: Record<PricingRule['scope'], string> = {
  GLOBAL: 'Global',
  CATEGORY: 'Category',
  PRODUCT: 'Products',
};

const PAGE_COPY: Record<PricingRuleType, { title: string; subtitle: string; newRuleLabel: string; emptyNoun: string }> = {
  MAKING_CHARGE: {
    title: 'Making Charge Rules',
    subtitle: 'Global, category, or product-scoped discounts on making charges.',
    newRuleLabel: 'New Rule',
    emptyNoun: 'making charge rules',
  },
  STONE: {
    title: 'Stone Discount Rules',
    subtitle: 'Discounts on gemstone value, optionally limited to certain stone types or a carat range.',
    newRuleLabel: 'New Rule',
    emptyNoun: 'stone discount rules',
  },
};

const LIST_ROUTE: Record<PricingRuleType, string> = {
  MAKING_CHARGE: '/pricing/making-charge-rules',
  STONE: '/pricing/stone-rules',
};

function discountLabel(rule: PricingRule): string {
  if (rule.discountType === 'PERCENT') return `${rule.discountValue}%`;
  if (rule.discountType === 'FIXED_AMOUNT') return `₹${rule.discountValue.toLocaleString('en-IN')}`;
  return `₹${rule.discountValue.toLocaleString('en-IN')}/ct`;
}

// Shared by both /pricing/making-charge-rules and /pricing/stone-rules
// (same relationship RuleFormPage already has to both routes) — the two
// rule types differ only in copy and route prefix, not in structure.
export function PricingRulesListPage({ ruleType }: PricingRulesListPageProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<PricingRule['status'] | ''>('');
  const [pendingDelete, setPendingDelete] = useState<PricingRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = PAGE_COPY[ruleType];
  const listRoute = LIST_ROUTE[ruleType];

  const { data, isLoading } = useQuery({
    queryKey: ['pricing-rules', ruleType, statusFilter],
    queryFn: () => fetchPricingRules({ ruleType, status: statusFilter || undefined, limit: 100 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });

  const activateMutation = useMutation({
    mutationFn: (id: string) => activatePricingRule(id),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not activate this rule.'),
  });
  const disableMutation = useMutation({
    mutationFn: (id: string) => disablePricingRule(id),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not disable this rule.'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePricingRule(id),
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not delete this rule.');
      setPendingDelete(null);
    },
  });

  const rules = data?.rules ?? [];

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>{copy.title}</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
            {copy.subtitle}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <select
            className={styles.formControl}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PricingRule['status'] | '')}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="DISABLED">Disabled</option>
          </select>
          <Link to={`${listRoute}/new`} className={`${sharedStyles.buttonPrimary} ${styles.actionButton}`}>
            {copy.newRuleLabel}
          </Link>
        </div>
      </div>

      {error && <p className={sharedStyles.error}>{error}</p>}

      <div className={sharedStyles.card}>
        {isLoading && <p className={sharedStyles.empty}>Loading…</p>}
        {!isLoading && rules.length === 0 && (
          <p className={sharedStyles.empty}>
            No {copy.emptyNoun} {statusFilter ? `with status ${statusFilter.toLowerCase()}` : 'yet'}.
          </p>
        )}
        {rules.length > 0 && (
          <div className={styles.tableScroll}>
            <table className={sharedStyles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>Discount</th>
                  <th>Override Mode</th>
                  <th>Status</th>
                  <th>Window</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <Link to={`${listRoute}/${rule.id}`} className={sharedStyles.buttonLink}>
                        {rule.name}
                      </Link>
                    </td>
                    <td>{SCOPE_LABEL[rule.scope]}</td>
                    <td>{discountLabel(rule)}</td>
                    <td>{rule.scope === 'PRODUCT' ? '—' : rule.overrideMode === 'SUPPRESS' ? 'Suppress' : 'Preserve'}</td>
                    <td>
                      <span className={STATUS_BADGE[rule.status]}>{rule.status}</span>
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      {rule.startsAt ? new Date(rule.startsAt).toLocaleDateString('en-IN') : 'Immediate'}
                      {' – '}
                      {rule.endsAt ? new Date(rule.endsAt).toLocaleDateString('en-IN') : 'No end'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                        {rule.status !== 'ACTIVE' && rule.status !== 'EXPIRED' && (
                          <button
                            type="button"
                            className={sharedStyles.buttonLink}
                            onClick={() => activateMutation.mutate(rule.id)}
                            disabled={activateMutation.isPending}
                          >
                            Activate
                          </button>
                        )}
                        {rule.status === 'ACTIVE' && (
                          <button
                            type="button"
                            className={sharedStyles.buttonLink}
                            onClick={() => disableMutation.mutate(rule.id)}
                            disabled={disableMutation.isPending}
                          >
                            Disable
                          </button>
                        )}
                        <button type="button" className={sharedStyles.buttonLink} onClick={() => setPendingDelete(rule)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete pricing rule"
          message={`Delete "${pendingDelete.name}"? Every product it affected will be repriced back to its next-best rule. Its audit history is kept permanently.`}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
