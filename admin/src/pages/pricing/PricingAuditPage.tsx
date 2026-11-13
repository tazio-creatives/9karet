import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPricingAudit } from '../../api/pricingRules';
import type { PricingAuditAction, PricingAuditEntry } from '../../api/types';
import sharedStyles from '../../styles/shared.module.css';
import styles from './pricing.module.css';

const ACTION_LABEL: Record<PricingAuditAction, string> = {
  CREATED: 'Rule Created',
  UPDATED: 'Rule Updated',
  ACTIVATED: 'Rule Activated',
  DEACTIVATED: 'Rule Disabled',
  SCHEDULED: 'Rule Scheduled',
  EXPIRED: 'Rule Expired',
  DELETED: 'Rule Deleted',
  REPRICE_STARTED: 'Repricing Started',
  REPRICE_COMPLETED: 'Repricing Completed',
  REPRICE_FAILED: 'Repricing Completed (with errors)',
  OVERRIDE_REMOVED: 'Override Removed',
  OVERRIDE_RESTORED: 'Override Restored',
  BULK_OVERRIDE_ACTION: 'Bulk Override Change',
};

const ACTION_BADGE: Record<PricingAuditAction, string> = {
  CREATED: sharedStyles.badgeInfo,
  UPDATED: sharedStyles.badgeInfo,
  ACTIVATED: sharedStyles.badgeSuccess,
  DEACTIVATED: sharedStyles.badgeWarning,
  SCHEDULED: sharedStyles.badgeInfo,
  EXPIRED: sharedStyles.badgeNeutral,
  DELETED: sharedStyles.badgeDanger,
  REPRICE_STARTED: sharedStyles.badgeInfo,
  REPRICE_COMPLETED: sharedStyles.badgeSuccess,
  REPRICE_FAILED: sharedStyles.badgeWarning,
  OVERRIDE_REMOVED: sharedStyles.badgeWarning,
  OVERRIDE_RESTORED: sharedStyles.badgeSuccess,
  BULK_OVERRIDE_ACTION: sharedStyles.badgeWarning,
};

function subjectLabel(entry: PricingAuditEntry): string {
  return entry.ruleNameSnapshot ?? entry.productName ?? '—';
}

function detailLabel(entry: PricingAuditEntry): string {
  switch (entry.action) {
    case 'REPRICE_COMPLETED':
    case 'REPRICE_FAILED':
      return entry.affectedProductCount != null ? `${entry.affectedProductCount} product${entry.affectedProductCount === 1 ? '' : 's'} repriced` : '';
    case 'DELETED':
      return entry.affectedProductCount != null ? `${entry.affectedProductCount} product${entry.affectedProductCount === 1 ? '' : 's'} affected` : '';
    case 'OVERRIDE_REMOVED':
    case 'BULK_OVERRIDE_ACTION':
    case 'OVERRIDE_RESTORED':
      return entry.productSku ?? '';
    default:
      return '';
  }
}

export function PricingAuditPage() {
  const [action, setAction] = useState<PricingAuditAction | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pricing-audit', action, from, to, page],
    queryFn: () =>
      fetchPricingAudit({
        action: action || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
        page,
        limit: 50,
      }),
  });

  const entries = data?.entries ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 50));

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>Pricing Audit History</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
            Every rule and override change, permanently — including rules that have since been deleted.
          </p>
        </div>
      </div>

      <div className={sharedStyles.cardPadded} style={{ marginBottom: 'var(--space-4)' }}>
        <div className={sharedStyles.formGrid}>
          <select
            className={styles.formControl}
            value={action}
            onChange={(e) => {
              setAction(e.target.value as PricingAuditAction | '');
              setPage(1);
            }}
          >
            <option value="">All actions</option>
            {(Object.keys(ACTION_LABEL) as PricingAuditAction[]).map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[a]}
              </option>
            ))}
          </select>
          <input
            className={styles.formControl}
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            aria-label="From date"
          />
          <input
            className={styles.formControl}
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            aria-label="To date"
          />
        </div>
      </div>

      <div className={sharedStyles.card}>
        {isLoading && <p className={sharedStyles.empty}>Loading…</p>}
        {!isLoading && entries.length === 0 && <p className={sharedStyles.empty}>No audit history matches these filters.</p>}
        {entries.length > 0 && (
          <div className={styles.tableScroll}>
            <table className={sharedStyles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Subject</th>
                  <th>Details</th>
                  <th>Admin</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(entry.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td>
                        <span className={ACTION_BADGE[entry.action]}>{ACTION_LABEL[entry.action]}</span>
                      </td>
                      <td>{subjectLabel(entry)}</td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{detailLabel(entry)}</td>
                      <td>{entry.adminName ?? '—'}</td>
                      <td>
                        {(entry.previousValue || entry.newValue) && (
                          <button
                            type="button"
                            className={sharedStyles.buttonLink}
                            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                          >
                            {expandedId === entry.id ? 'Hide' : 'View'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr>
                        <td colSpan={6}>
                          <pre
                            style={{
                              fontSize: 'var(--text-xs)',
                              background: 'var(--color-bg)',
                              padding: 'var(--space-3)',
                              borderRadius: 'var(--radius-sm)',
                              overflowX: 'auto',
                              margin: 0,
                            }}
                          >
                            {JSON.stringify({ previous: entry.previousValue, new: entry.newValue }, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className={sharedStyles.pagination}>
          <button type="button" className={sharedStyles.button} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button type="button" className={sharedStyles.button} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
