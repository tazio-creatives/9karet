import type { PricingRuleType, RulePreviewResult } from '../../api/types';
import { formatPrice } from '../../utils/formatPrice';
import sharedStyles from '../../styles/shared.module.css';
import styles from './pricing.module.css';

const EXCLUDED_REASON_LABEL: Record<string, string> = {
  PRICE_LOCKED: 'Price-locked',
  NO_MATCHING_STONE: 'No matching stone on product',
  MISSING_PRICING_DATA: 'Missing pricing data',
};

interface RulePreviewPanelProps {
  ruleType: PricingRuleType;
  overrideModeIsSuppress: boolean;
  result: RulePreviewResult | undefined;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  canPreview: boolean;
  onRunPreview: () => void;
}

// The mandatory pre-save impact summary — every save action in
// RuleFormPage is gated on `result` existing and !isStale, so an admin
// always sees this before a rule can go live. Presentational only; the
// parent owns the mutation and the "has the form changed since the last
// preview ran" staleness check.
export function RulePreviewPanel({
  ruleType,
  overrideModeIsSuppress,
  result,
  isLoading,
  isStale,
  error,
  canPreview,
  onRunPreview,
}: RulePreviewPanelProps) {
  return (
    <div className={styles.previewPanel}>
      <div className={sharedStyles.pageHeader} style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>Rule Preview</h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
            Required before saving — shows exactly who this rule reaches and what changes.
          </p>
        </div>
        <button
          type="button"
          className={`${sharedStyles.buttonPrimary} ${styles.actionButton}`}
          onClick={onRunPreview}
          disabled={!canPreview || isLoading}
        >
          {isLoading ? 'Calculating…' : result ? 'Re-run Preview' : 'Preview Impact'}
        </button>
      </div>

      {!canPreview && (
        <p className={sharedStyles.empty}>Fill in the scope and discount fields above, then preview this rule's impact.</p>
      )}
      {error && <p className={sharedStyles.error}>{error}</p>}

      {result && (
        <>
          {isStale && (
            <p className={styles.previewWarning}>
              The form has changed since this preview ran — re-run it before saving so the numbers below stay accurate.
            </p>
          )}

          <div className={styles.previewStatsGrid}>
            <div className={styles.previewStat}>
              <span className={styles.previewStatValue}>{result.totalProductsInScope.toLocaleString('en-IN')}</span>
              <span className={styles.previewStatLabel}>Products in scope</span>
            </div>
            {ruleType === 'STONE' && result.matchingStoneCount != null && (
              <div className={styles.previewStat}>
                <span className={styles.previewStatValue}>{result.matchingStoneCount.toLocaleString('en-IN')}</span>
                <span className={styles.previewStatLabel}>Products with matching stones</span>
              </div>
            )}
            <div className={styles.previewStat}>
              <span className={styles.previewStatValue}>{result.withExistingOverrides.toLocaleString('en-IN')}</span>
              <span className={styles.previewStatLabel}>Have their own override</span>
            </div>
            <div className={styles.previewStat}>
              <span className={styles.previewStatValue}>{result.willReceiveRule.toLocaleString('en-IN')}</span>
              <span className={styles.previewStatLabel}>Will receive this rule</span>
            </div>
          </div>

          {overrideModeIsSuppress && result.suppressedCount > 0 && (
            <p className={styles.previewWarning}>
              {result.suppressedCount.toLocaleString('en-IN')} product{result.suppressedCount === 1 ? '' : 's'} currently
              {' '}has an individual override and will be temporarily suppressed while this rule is active — their own
              override applies again automatically the moment this rule is disabled, expires, or is deleted.
            </p>
          )}
          {result.clampedCount > 0 && (
            <p className={styles.previewWarning}>
              {result.clampedCount.toLocaleString('en-IN')} product{result.clampedCount === 1 ? '' : 's'} would have this
              discount clamped to ₹0 — the discount amount exceeds the component being discounted for those products.
            </p>
          )}
          {result.excluded.length > 0 && (
            <p className={sharedStyles.error} style={{ color: 'var(--color-text-muted)' }}>
              Excluded: {result.excluded.map((e) => `${e.count} ${EXCLUDED_REASON_LABEL[e.reason] ?? e.reason}`).join(' · ')}
            </p>
          )}

          {result.samples.length > 0 && (
            <div className={styles.sampleTableWrap}>
              <table className={sharedStyles.table}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Making Charge</th>
                    <th>Stone Value</th>
                    <th>Selling Price</th>
                  </tr>
                </thead>
                <tbody>
                  {result.samples.map((s) => (
                    <tr key={s.productId}>
                      <td>
                        {s.name}
                        <br />
                        <span style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-xs)' }}>{s.sku}</span>
                      </td>
                      <td>
                        {formatPrice(s.before.makingCharge)}
                        {s.after.makingCharge !== s.before.makingCharge && (
                          <>
                            {' → '}
                            <span className={styles.priceDelta}>{formatPrice(s.after.makingCharge)}</span>
                          </>
                        )}
                      </td>
                      <td>
                        {formatPrice(s.before.stoneValue)}
                        {s.after.stoneValue !== s.before.stoneValue && (
                          <>
                            {' → '}
                            <span className={styles.priceDelta}>{formatPrice(s.after.stoneValue)}</span>
                          </>
                        )}
                      </td>
                      <td>
                        {formatPrice(s.before.sellingPrice)}
                        {s.after.sellingPrice !== s.before.sellingPrice && (
                          <>
                            {' → '}
                            <span className={styles.priceDelta}>{formatPrice(s.after.sellingPrice)}</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.willReceiveRule > result.samples.length && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                  Showing {result.samples.length} of {result.willReceiveRule.toLocaleString('en-IN')} affected products.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
