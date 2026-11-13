import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProductOverrides, bulkProductOverrideAction } from '../../api/productOverrides';
import { fetchAdminCategories } from '../../api/categories';
import type { ProductOverride, ProductOverrideBulkAction } from '../../api/types';
import { ApiError } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { categoryPathOptions } from '../../utils/categoryTree';
import sharedStyles from '../../styles/shared.module.css';
import styles from './pricing.module.css';

type TriFilter = '' | 'true' | 'false';

interface PendingBulkAction {
  action: ProductOverrideBulkAction;
  title: string;
  message: string;
}

const BULK_ACTION_COPY: Record<ProductOverrideBulkAction, { label: string; title: string; message: (n: number) => string }> = {
  REMOVE_MAKING_OVERRIDE: {
    label: 'Remove Making-Charge Override',
    title: 'Remove making-charge overrides',
    message: (n) =>
      `Permanently clear the making-charge discount override on ${n} product${n === 1 ? '' : 's'}? Each will fall back to any Category/Global rule, or 0% if none applies. Base pricing (gold value, making charge amount, selling price history) is never touched, and this can be undone with Restore Previous Overrides.`,
  },
  REMOVE_STONE_OVERRIDE: {
    label: 'Remove Stone Override',
    title: 'Remove gemstone-value overrides',
    message: (n) =>
      `Permanently clear the gemstone-value discount override on ${n} product${n === 1 ? '' : 's'}? Base pricing is never touched, and this can be undone with Restore Previous Overrides.`,
  },
  DISABLE_OVERRIDES: {
    label: 'Disable Selected Overrides',
    title: 'Disable all overrides',
    message: (n) =>
      `Permanently clear BOTH the making-charge and gemstone-value overrides on ${n} product${n === 1 ? '' : 's'}? This can be undone with Restore Previous Overrides.`,
  },
  RESTORE_PREVIOUS_OVERRIDES: {
    label: 'Restore Previous Overrides',
    title: 'Restore previous overrides',
    message: (n) =>
      `Restore the most recently cleared override for ${n} product${n === 1 ? '' : 's'}? Products with nothing to restore are skipped automatically.`,
  },
};

// Deliberately reads the RAW flat columns (flatMakingChargeDiscountPercent/
// flatStoneDiscountPercent), never the cached effective* columns — those
// are only refreshed when applyBaseProductPricing actually runs for a
// product (e.g. on its next save), so they can lag behind a flat column
// that was just changed. This page's whole purpose is showing exactly
// what's overridden RIGHT NOW, so it can't afford to show a stale number.
// A product whose override comes from a per-purity row rather than the
// flat column (flat still 0) says so explicitly instead of showing a
// misleading "0%".
function overrideSummary(row: ProductOverride): string {
  const parts: string[] = [];
  if (row.hasMakingOverride) {
    parts.push(row.flatMakingChargeDiscountPercent > 0 ? `${row.flatMakingChargeDiscountPercent}% making` : 'Making (by purity)');
  }
  if (row.hasStoneOverride) {
    parts.push(row.flatStoneDiscountPercent > 0 ? `${row.flatStoneDiscountPercent}% stones` : 'Stones (by purity rule)');
  }
  return parts.join(' · ') || '—';
}

function exportOverridesCsv(rows: ProductOverride[]) {
  const header = ['SKU', 'Name', 'Category', 'Making Override %', 'Stone Override %', 'Restorable'];
  const csvRows = rows.map((r) => [
    r.sku,
    r.name,
    r.categoryName ?? '',
    r.hasMakingOverride ? (r.flatMakingChargeDiscountPercent > 0 ? String(r.flatMakingChargeDiscountPercent) : 'by purity') : '',
    r.hasStoneOverride ? (r.flatStoneDiscountPercent > 0 ? String(r.flatStoneDiscountPercent) : 'by purity') : '',
    r.hasRestorableOverride ? 'Yes' : 'No',
  ]);
  const csv = [header, ...csvRows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `product-overrides-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ProductOverridesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [hasMakingOverride, setHasMakingOverride] = useState<TriFilter>('');
  const [hasStoneOverride, setHasStoneOverride] = useState<TriFilter>('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<PendingBulkAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const filters = {
    search: search || undefined,
    categoryId: categoryId || undefined,
    hasMakingOverride: hasMakingOverride === '' ? undefined : hasMakingOverride === 'true',
    hasStoneOverride: hasStoneOverride === '' ? undefined : hasStoneOverride === 'true',
  };

  const { data, isLoading } = useQuery({
    queryKey: ['product-overrides', filters, page],
    queryFn: () => fetchProductOverrides({ ...filters, page, limit: 25 }),
  });
  const { data: categoriesData } = useQuery({ queryKey: ['admin-categories'], queryFn: fetchAdminCategories });

  const rows = useMemo(() => data?.overrides ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of rows) next.delete(r.id);
      } else {
        for (const r of rows) next.add(r.id);
      }
      return next;
    });
  }
  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const bulkMutation = useMutation({
    mutationFn: (action: ProductOverrideBulkAction) =>
      bulkProductOverrideAction({ productIds: [...selected], action, confirmed: true }),
    onSuccess: (result, action) => {
      queryClient.invalidateQueries({ queryKey: ['product-overrides'] });
      setSelected(new Set());
      setPendingAction(null);
      setError(null);
      if (action === 'RESTORE_PREVIOUS_OVERRIDES') {
        setNotice(
          `Restored ${result.restoredCount ?? 0} product${result.restoredCount === 1 ? '' : 's'}` +
            (result.skippedCount ? ` (${result.skippedCount} had nothing to restore).` : '.'),
        );
      } else {
        setNotice('Change applied — affected products are being repriced now.');
      }
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not apply this action.');
      setPendingAction(null);
    },
  });

  async function handleExport() {
    setIsExporting(true);
    try {
      const res = await fetchProductOverrides({ ...filters, page: 1, limit: 2000 });
      exportOverridesCsv(res.overrides);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not export CSV.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>Product Overrides</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
            Every product with its own making-charge or gemstone-value discount — independent of any Category/Global
            rule. Clearing an override here never deletes base pricing data and can always be restored.
          </p>
        </div>
        <button type="button" className={`${sharedStyles.button} ${styles.actionButton}`} onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Exporting…' : 'Export as CSV'}
        </button>
      </div>

      <div className={sharedStyles.cardPadded} style={{ marginBottom: 'var(--space-4)' }}>
        <div className={sharedStyles.formGrid}>
          <input
            className={styles.formControl}
            type="search"
            placeholder="Search by name or SKU…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select className={styles.formControl} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {categoryPathOptions(categoriesData?.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.pathLabel}
              </option>
            ))}
          </select>
          <select
            className={styles.formControl}
            value={hasMakingOverride}
            onChange={(e) => { setHasMakingOverride(e.target.value as TriFilter); setPage(1); }}
          >
            <option value="">Making override: any</option>
            <option value="true">Has making override</option>
            <option value="false">No making override</option>
          </select>
          <select
            className={styles.formControl}
            value={hasStoneOverride}
            onChange={(e) => { setHasStoneOverride(e.target.value as TriFilter); setPage(1); }}
          >
            <option value="">Stone override: any</option>
            <option value="true">Has stone override</option>
            <option value="false">No stone override</option>
          </select>
        </div>
      </div>

      {error && <p className={sharedStyles.error}>{error}</p>}
      {notice && <p className={sharedStyles.success}>{notice}</p>}

      {selected.size > 0 && (
        <div className={sharedStyles.cardPadded} style={{ marginBottom: 'var(--space-4)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
          <strong style={{ fontSize: 'var(--text-sm)' }}>{selected.size} selected</strong>
          {(Object.keys(BULK_ACTION_COPY) as ProductOverrideBulkAction[]).map((action) => (
            <button
              key={action}
              type="button"
              className={`${sharedStyles.button} ${styles.actionButton}`}
              onClick={() =>
                setPendingAction({
                  action,
                  title: BULK_ACTION_COPY[action].title,
                  message: BULK_ACTION_COPY[action].message(selected.size),
                })
              }
            >
              {BULK_ACTION_COPY[action].label}
            </button>
          ))}
        </div>
      )}

      <div className={sharedStyles.card}>
        {isLoading && <p className={sharedStyles.empty}>Loading…</p>}
        {!isLoading && rows.length === 0 && <p className={sharedStyles.empty}>No products match these filters.</p>}
        {rows.length > 0 && (
          <div className={styles.tableScroll}>
            <table className={sharedStyles.table}>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="Select all visible" />
                  </th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Override</th>
                  <th>Restorable</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} aria-label={`Select ${row.name}`} />
                    </td>
                    <td>
                      {row.name}
                      <br />
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)' }}>{row.sku}</span>
                    </td>
                    <td>{row.categoryName ?? '—'}</td>
                    <td>{overrideSummary(row)}</td>
                    <td>
                      {row.hasRestorableOverride ? (
                        <span className={sharedStyles.badgeInfo}>Yes</span>
                      ) : (
                        <span className={sharedStyles.badgeNeutral}>—</span>
                      )}
                    </td>
                  </tr>
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

      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.title}
          message={pendingAction.message}
          confirmLabel={BULK_ACTION_COPY[pendingAction.action].label}
          danger={pendingAction.action !== 'RESTORE_PREVIOUS_OVERRIDES'}
          isPending={bulkMutation.isPending}
          onConfirm={() => bulkMutation.mutate(pendingAction.action)}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
