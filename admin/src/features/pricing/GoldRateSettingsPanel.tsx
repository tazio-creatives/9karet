import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchGoldRateOverview,
  setManualGoldRate,
  syncGoldRates,
  updateGoldRateSettings,
  type GoldRateSettingsInput,
} from '../../api/pricing';
import type { GoldRateAdjustmentType, GoldRateSource, GoldRateSyncRunRow } from '../../api/types';
import { ApiError } from '../../api/client';
import sharedStyles from '../../styles/shared.module.css';
import styles from './GoldRateSettingsPanel.module.css';

function formatRate(value: string | number | null): string {
  if (value == null) return '—';
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/g`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

// A sync run older than 2x the 15-minute cron interval without a successful
// fetch is treated as stale rather than simply "connected" — surfaces a
// quietly-broken feed instead of showing a green status on old data.
const STALE_AFTER_MS = 30 * 60 * 1000;

function apiStatus(run: GoldRateSyncRunRow | null): { label: string; badgeClass: string } {
  if (!run) return { label: 'Unknown', badgeClass: sharedStyles.badgeNeutral };
  const ageMs = Date.now() - new Date(run.created_at).getTime();
  if (run.primary_status === 'SUCCESS') {
    return ageMs > STALE_AFTER_MS
      ? { label: 'Stale', badgeClass: sharedStyles.badgeWarning }
      : { label: 'Connected', badgeClass: sharedStyles.badgeSuccess };
  }
  if (run.fallback_status === 'SUCCESS') {
    return { label: 'Connected (GoldAPI fallback)', badgeClass: sharedStyles.badgeWarning };
  }
  return { label: 'Failed', badgeClass: sharedStyles.badgeDanger };
}

export function GoldRateSettingsPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<GoldRateSource>('AUTOMATIC');
  const [adjustmentType, setAdjustmentType] = useState<GoldRateAdjustmentType>('NONE');
  const [adjustmentValue, setAdjustmentValue] = useState(0);
  const [maxDeviationPercent, setMaxDeviationPercent] = useState(10);
  const [manualRate, setManualRate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-gold-rate-settings'],
    queryFn: fetchGoldRateOverview,
  });

  // Sync local form state whenever fresh settings arrive (initial load, or
  // after another admin/tab changes them) — but never fight the admin mid-edit.
  useEffect(() => {
    if (!data) return;
    setSource(data.settings.source);
    setAdjustmentType(data.settings.adjustment_type);
    setAdjustmentValue(Number(data.settings.adjustment_value));
    setMaxDeviationPercent(Number(data.settings.max_deviation_percent));
  }, [data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-gold-rate-settings'] });

  const saveSettingsMutation = useMutation({
    mutationFn: (input: GoldRateSettingsInput) => updateGoldRateSettings(input),
    onSuccess: () => {
      setError(null);
      invalidate();
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['admin-gold-rates'] }), 2500);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not save gold rate settings.'),
  });

  const manualRateMutation = useMutation({
    mutationFn: (rate24k: number) => setManualGoldRate(rate24k),
    onSuccess: () => {
      setError(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['admin-gold-rates'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not save the manual gold rate.'),
  });

  const refreshMutation = useMutation({
    mutationFn: syncGoldRates,
    onSuccess: () => {
      setError(null);
      setTimeout(() => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ['admin-gold-rates'] });
      }, 2500);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not refresh the gold rate.'),
  });

  if (isLoading || !data) {
    return <p className={sharedStyles.empty}>Loading…</p>;
  }

  const { latestSyncRun, currentRates } = data;
  const status = apiStatus(latestSyncRun);
  const apiRate =
    latestSyncRun?.primary_status === 'SUCCESS'
      ? latestSyncRun.primary_rate
      : (latestSyncRun?.fallback_rate ?? null);
  // Deliberately read from currentRates (the actually-applied gold_rates
  // row), not latestSyncRun.effective_rate_24k — a REJECTED or FAILED sync
  // run still records the rate it attempted/rejected in that column for
  // audit purposes, which would otherwise show a rate that was never
  // actually applied to pricing as if it were live.
  const effectiveRate = currentRates.find((r) => r.purity === '24K')?.rate_per_gram ?? null;

  return (
    <div className={styles.panel}>
      {error && <p className={sharedStyles.error}>{error}</p>}

      {latestSyncRun?.status === 'REJECTED' && (
        <div className={styles.reviewBanner}>
          <strong>Held for review:</strong> {latestSyncRun.rejected_reason} — the previous rate is still active.
        </div>
      )}

      <div className={styles.row}>
        <label className={sharedStyles.field}>
          Gold Rate Source
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as GoldRateSource)}
          >
            <option value="AUTOMATIC">Automatic — OroPocket</option>
            <option value="MANUAL">Manual</option>
          </select>
        </label>

        <div className={sharedStyles.field}>
          API Gold Rate (24K)
          <div className={styles.readout}>{formatRate(apiRate)}</div>
        </div>
      </div>

      {source === 'AUTOMATIC' && (
        <div className={styles.row}>
          <label className={sharedStyles.field}>
            Adjustment Type
            <select
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value as GoldRateAdjustmentType)}
            >
              <option value="NONE">None</option>
              <option value="FIXED">Fixed ₹ per gram</option>
              <option value="PERCENTAGE">Percentage</option>
            </select>
          </label>

          {adjustmentType !== 'NONE' && (
            <label className={sharedStyles.field}>
              Adjustment {adjustmentType === 'FIXED' ? '(₹/gram)' : '(%)'}
              <input
                type="number"
                step="0.01"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(Number(e.target.value))}
              />
            </label>
          )}

          <label className={sharedStyles.field}>
            Max Rate Change Allowed (%)
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={maxDeviationPercent}
              onChange={(e) => setMaxDeviationPercent(Number(e.target.value))}
            />
          </label>
        </div>
      )}
      {source === 'AUTOMATIC' && (
        <p className={styles.lastUpdated}>
          If a new API rate moves by more than this percentage from the current rate, it&rsquo;s held for review
          instead of applied automatically.
        </p>
      )}

      {source === 'MANUAL' && (
        <div className={styles.row}>
          <label className={sharedStyles.field}>
            Enter 24K Gold Rate (₹/gram)
            <input
              type="number"
              step="0.01"
              min="0"
              value={manualRate}
              onChange={(e) => setManualRate(e.target.value)}
              placeholder="e.g. 16100.00"
            />
          </label>
          <button
            type="button"
            className={sharedStyles.buttonPrimary}
            disabled={manualRateMutation.isPending || !manualRate}
            onClick={() => manualRateMutation.mutate(Number(manualRate))}
          >
            {manualRateMutation.isPending ? 'Saving…' : 'Save Manual Rate'}
          </button>
        </div>
      )}

      <div className={styles.row}>
        <div className={sharedStyles.field}>
          Effective 24K Rate
          <div className={styles.readoutStrong}>{formatRate(effectiveRate)}</div>
        </div>
        <div className={sharedStyles.field}>
          Status
          <div>
            <span className={status.badgeClass}>● {status.label}</span>
          </div>
        </div>
      </div>

      <p className={styles.lastUpdated}>
        Last successful API update:{' '}
        {latestSyncRun?.primary_status === 'SUCCESS' || latestSyncRun?.fallback_status === 'SUCCESS'
          ? formatDateTime(latestSyncRun.created_at)
          : 'never'}
      </p>

      <div className={sharedStyles.formActions}>
        <button
          type="button"
          className={sharedStyles.buttonPrimary}
          disabled={saveSettingsMutation.isPending}
          onClick={() =>
            saveSettingsMutation.mutate({
              source,
              adjustmentType,
              adjustmentValue,
              maxDeviationPercent,
            })
          }
        >
          {saveSettingsMutation.isPending ? 'Saving…' : 'Save Settings'}
        </button>
        <button
          type="button"
          className={sharedStyles.button}
          disabled={refreshMutation.isPending}
          onClick={() => refreshMutation.mutate()}
        >
          {refreshMutation.isPending ? 'Refreshing…' : 'Refresh Rate'}
        </button>
      </div>
    </div>
  );
}
