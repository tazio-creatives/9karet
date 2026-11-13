import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs } from '../api/auditLogs';
import sharedStyles from '../styles/shared.module.css';
import styles from './AuditLogsPage.module.css';

const ENTITIES = [
  'products',
  'categories',
  'collections',
  'orders',
  'customers',
  'homepage',
  'reviews',
  'coupons',
  'admin-users',
  'shipping',
  'pricing',
];

export function AuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const entity = searchParams.get('entity') ?? '';
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit-logs', { entity, page }],
    queryFn: () => fetchAuditLogs(entity || undefined, page, 50),
  });

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>Audit Logs</h1>
      </div>

      <div className={styles.filters}>
        <select
          value={entity}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams);
            if (e.target.value) next.set('entity', e.target.value);
            else next.delete('entity');
            setSearchParams(next);
            setPage(1);
          }}
        >
          <option value="">All entities</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      <div className={sharedStyles.card}>
        {isLoading && <p className={sharedStyles.empty}>Loading…</p>}
        {!isLoading && data && data.logs.length === 0 && (
          <p className={sharedStyles.empty}>No audit log entries match this filter.</p>
        )}
        {!isLoading && data && data.logs.length > 0 && (
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log) => (
                <tr key={log.id}>
                  <td className={styles.when}>
                    {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td>{log.adminFullName ?? log.adminEmail ?? '—'}</td>
                  <td>
                    <span className={sharedStyles.badgeNeutral}>{log.action}</span>
                  </td>
                  <td>
                    {log.entity}
                    {log.entityId && <div className={styles.entityId}>{log.entityId}</div>}
                  </td>
                  <td className={styles.diff}>
                    {log.diff ? <pre className={styles.diffPre}>{JSON.stringify(log.diff, null, 0)}</pre> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className={sharedStyles.pagination}>
          <button type="button" className={sharedStyles.button} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <button
            type="button"
            className={sharedStyles.button}
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
