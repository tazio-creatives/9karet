import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchGoldRates } from '../../api/pricing';
import { fetchStoneTypes, createStoneType, updateStoneType } from '../../api/stoneTypes';
import { StoneTypeForm } from '../../features/pricing/StoneTypeForm';
import { GoldRateSettingsPanel } from '../../features/pricing/GoldRateSettingsPanel';
import type { StoneType } from '../../api/types';
import sharedStyles from '../../styles/shared.module.css';
import styles from './RatesPage.module.css';

// 9K is the rate products are priced at; 24K is the market rate the live
// feed quotes, shown for reference.
const PURITY_ORDER = ['9K', '24K'];
const PURITY_LABEL: Record<string, string> = { '9K': '9K (selling rate)', '24K': '24K (market reference)' };

type StoneTypeMode = { type: 'none' } | { type: 'add' } | { type: 'edit'; stoneType: StoneType };

function formatRate(value: string | number): string {
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

// The "Rates & Stones" tab of Pricing (see PricingLayout.tsx for the tab
// shell): the live gold rate, and the Stone Types master list products pick
// their stones from and Stone Discount Rules are scoped by.
export function RatesPage() {
  const queryClient = useQueryClient();
  const [showGoldHistory, setShowGoldHistory] = useState(false);
  const [stoneTypeMode, setStoneTypeMode] = useState<StoneTypeMode>({ type: 'none' });

  const { data: goldData, isLoading: isGoldLoading } = useQuery({
    queryKey: ['admin-gold-rates'],
    queryFn: fetchGoldRates,
  });

  const { data: stoneTypeData, isLoading: isStoneTypeLoading } = useQuery({
    queryKey: ['admin-stone-types'],
    queryFn: () => fetchStoneTypes(),
  });

  const invalidateStoneTypes = () => queryClient.invalidateQueries({ queryKey: ['admin-stone-types'] });

  const createStoneTypeMutation = useMutation({
    mutationFn: createStoneType,
    onSuccess: () => {
      invalidateStoneTypes();
      setStoneTypeMode({ type: 'none' });
    },
  });
  const updateStoneTypeMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateStoneType>[1] }) =>
      updateStoneType(id, input),
    onSuccess: () => {
      invalidateStoneTypes();
      setStoneTypeMode({ type: 'none' });
    },
  });

  const goldRates = [...(goldData?.current ?? [])].sort(
    (a, b) => PURITY_ORDER.indexOf(a.purity) - PURITY_ORDER.indexOf(b.purity),
  );
  const stoneTypes = stoneTypeData?.stoneTypes ?? [];

  return (
    <div>
      <section className={sharedStyles.cardPadded}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionHeading}>Gold Rates</h2>
            <p className={styles.sectionSubtext}>
              Sourced automatically from OroPocket every 15 minutes (GoldAPI as temporary fallback). Products are
              priced at the 9K rate (24K × 9/24) and auto-recalculate whenever it changes (unless price-locked).
            </p>
          </div>
        </div>

        <GoldRateSettingsPanel />

        {isGoldLoading && <p className={sharedStyles.empty}>Loading…</p>}
        {!isGoldLoading && goldRates.length === 0 && (
          <p className={sharedStyles.empty}>No gold rates yet — click "Sync Now" to fetch the first one.</p>
        )}
        {goldRates.length > 0 && (
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>Purity</th>
                <th>Rate / gram</th>
                <th>Source</th>
                <th>Last Synced</th>
              </tr>
            </thead>
            <tbody>
              {goldRates.map((rate) => (
                <tr key={rate.id}>
                  <td>{PURITY_LABEL[rate.purity] ?? rate.purity}</td>
                  <td>{formatRate(rate.rate_per_gram)}</td>
                  <td>{rate.source}</td>
                  <td>{formatDateTime(rate.fetched_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {(goldData?.history.length ?? 0) > 0 && (
          <>
            <button type="button" className={sharedStyles.buttonLink} onClick={() => setShowGoldHistory((v) => !v)}>
              {showGoldHistory ? 'Hide history' : 'Show rate history'}
            </button>
            {showGoldHistory && (
              <table className={`${sharedStyles.table} ${styles.historyTable}`}>
                <thead>
                  <tr>
                    <th>Purity</th>
                    <th>Rate / gram</th>
                    <th>Source</th>
                    <th>Fetched</th>
                  </tr>
                </thead>
                <tbody>
                  {goldData?.history.map((rate) => (
                    <tr key={rate.id}>
                      <td>{rate.purity}</td>
                      <td>{formatRate(rate.rate_per_gram)}</td>
                      <td>{rate.source}</td>
                      <td>{formatDateTime(rate.fetched_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      <section className={`${sharedStyles.cardPadded} ${styles.section}`}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionHeading}>Stone Types</h2>
            <p className={styles.sectionSubtext}>
              The gemstones a product's stones are picked from (e.g. Ruby, Emerald, Cubic Zirconia) — each product
              enters its own weight and price per stone. Also what Stone Discount Rules can be limited to. A type in
              use can be deactivated but not deleted.
            </p>
          </div>
          {stoneTypeMode.type === 'none' && (
            <button type="button" className={sharedStyles.buttonPrimary} onClick={() => setStoneTypeMode({ type: 'add' })}>
              Add Stone Type
            </button>
          )}
        </div>

        {stoneTypeMode.type === 'add' && (
          <div className={styles.formWrapper}>
            <StoneTypeForm
              onSubmit={(input) => createStoneTypeMutation.mutateAsync(input)}
              onCancel={() => setStoneTypeMode({ type: 'none' })}
            />
          </div>
        )}
        {stoneTypeMode.type === 'edit' && (
          <div className={styles.formWrapper}>
            <StoneTypeForm
              initial={stoneTypeMode.stoneType}
              onSubmit={(input) => updateStoneTypeMutation.mutateAsync({ id: stoneTypeMode.stoneType.id, input })}
              onCancel={() => setStoneTypeMode({ type: 'none' })}
            />
          </div>
        )}

        {isStoneTypeLoading && <p className={sharedStyles.empty}>Loading…</p>}
        {!isStoneTypeLoading && stoneTypes.length === 0 && (
          <p className={sharedStyles.empty}>No stone types yet — add one before adding stones to a product.</p>
        )}
        {stoneTypes.length > 0 && (
          <table className={sharedStyles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Sort</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stoneTypes.map((stoneType) => (
                <tr key={stoneType.id}>
                  <td>{stoneType.name}</td>
                  <td>{stoneType.sortOrder}</td>
                  <td>
                    <span className={stoneType.isActive ? sharedStyles.badgeSuccess : sharedStyles.badgeNeutral}>
                      {stoneType.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{formatDateTime(stoneType.updatedAt)}</td>
                  <td className={styles.rowActions}>
                    <button
                      type="button"
                      className={sharedStyles.buttonLink}
                      onClick={() => setStoneTypeMode({ type: 'edit', stoneType })}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
