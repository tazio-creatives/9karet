import { useState } from 'react';
import { CUSTOMER_CATEGORIES, REAL_JEWELLERY_TYPES, type CustomerCategory, type JewelleryType, type StudioJob } from '../../api/aiStudio';
import { Toggle } from '../../components/Toggle';
import { isRoseGoldForced, formatCustomerCategory, inferJewelleryTypeFromCategory, presenterDemographicSummary } from './generationRules';
import sharedStyles from '../../styles/shared.module.css';
import styles from './AnalyseConfirmStep.module.css';

function formatType(type: string) {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

interface AnalyseConfirmStepProps {
  job: StudioJob;
  productName: string;
  productCategoryName: string | null;
  jewelleryType: JewelleryType | '';
  onJewelleryTypeChange: (_v: JewelleryType) => void;
  categoryConfirmed: boolean;
  onCategoryConfirmedChange: (_v: boolean) => void;
  generateRoseGold: boolean;
  onGenerateRoseGoldChange: (_v: boolean) => void;
  customerCategory: CustomerCategory | '';
  onCustomerCategoryChange: (_v: CustomerCategory) => void;
  customerCategoryConfirmed: boolean;
  onCustomerCategoryConfirmedChange: (_v: boolean) => void;
  includeProductSizeImage: boolean;
  onIncludeProductSizeImageChange: (_v: boolean) => void;
}

// AI-detected attributes are suggestions only — nothing here is ever applied
// to the product without the admin explicitly confirming it below. The
// confirmed jewellery type becomes authoritative for every prompt, and the
// AI never silently changes it afterwards (Problem 1 in the approved plan).
// The studio is always opened from an existing product, so the "existing
// product category" is read from the product record, not re-entered.
export function AnalyseConfirmStep({
  job,
  productName,
  productCategoryName,
  jewelleryType,
  onJewelleryTypeChange,
  categoryConfirmed,
  onCategoryConfirmedChange,
  generateRoseGold,
  onGenerateRoseGoldChange,
  customerCategory,
  onCustomerCategoryChange,
  customerCategoryConfirmed,
  onCustomerCategoryConfirmedChange,
  includeProductSizeImage,
  onIncludeProductSizeImageChange,
}: AnalyseConfirmStepProps) {
  const [isPickingCategory, setIsPickingCategory] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isPickingAudience, setIsPickingAudience] = useState(false);
  const analysis = job.analysis;

  function confirmAudienceWith(category: CustomerCategory) {
    onCustomerCategoryChange(category);
    onCustomerCategoryConfirmedChange(true);
    setIsPickingAudience(false);
  }

  const presenterSummary = customerCategory ? presenterDemographicSummary(customerCategory) : null;
  const generationSummary = customerCategory
    ? [
        formatCustomerCategory(customerCategory),
        presenterSummary,
        generateRoseGold ? 'Gold & Rose Gold' : 'Gold Only',
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  const inferredType = inferJewelleryTypeFromCategory(productCategoryName);
  const hasComparableCategory = inferredType != null;
  const matches = hasComparableCategory && !!analysis && analysis.jewelleryType === inferredType;
  const mismatches = hasComparableCategory && !!analysis && analysis.jewelleryType !== 'UNKNOWN' && !matches;

  function confirmWith(type: JewelleryType) {
    onJewelleryTypeChange(type);
    onCategoryConfirmedChange(true);
    setIsPickingCategory(false);
  }

  const filteredTypes = REAL_JEWELLERY_TYPES.filter((t) =>
    formatType(t).toLowerCase().includes(categoryFilter.trim().toLowerCase()),
  );

  return (
    <div>
      <div className={styles.referenceRow}>
        {job.referenceImageUrls.map((url) => (
          <img key={url} src={url} alt="Reference" className={styles.referenceImg} />
        ))}
      </div>

      <div className={styles.productInfo}>
        <div>
          <p className={styles.productInfoLabel}>Product Name</p>
          <p className={styles.productInfoValue}>{productName}</p>
        </div>
        <div>
          <p className={styles.productInfoLabel}>Existing Product Category</p>
          <p className={styles.productInfoValue}>{productCategoryName ?? '—'}</p>
        </div>
      </div>

      {analysis && (
        <div className={styles.attrGrid}>
          <div className={styles.attrCard}>
            <p className={styles.attrLabel}>AI-Detected Jewellery Type</p>
            <p className={styles.attrValue}>{formatType(analysis.jewelleryType)}</p>
            <span className={styles.confidence}>Confidence: {pct(analysis.jewelleryTypeConfidence)}</span>
          </div>
          <div className={styles.attrCard}>
            <p className={styles.attrLabel}>Detected Gemstone</p>
            <p className={styles.attrValue}>{analysis.gemstone ?? '—'}</p>
            <span className={styles.confidence}>Confidence: {pct(analysis.gemstoneConfidence)}</span>
          </div>
          <div className={styles.attrCard}>
            <p className={styles.attrLabel}>Dominant Shape</p>
            <p className={styles.attrValue}>{analysis.dominantShape ?? '—'}</p>
            <span className={styles.confidence}>Confidence: {pct(analysis.shapeConfidence)}</span>
          </div>
          <div className={styles.attrCard}>
            <p className={styles.attrLabel}>AI Confidence</p>
            <p className={styles.attrValue}>{pct(analysis.jewelleryTypeConfidence)}</p>
          </div>
        </div>
      )}

      {matches && (
        <p className={styles.matchNotice}>Product category confirmed: {formatType(inferredType as JewelleryType)}</p>
      )}
      {mismatches && analysis && (
        <p className={styles.mismatchNotice}>
          Category mismatch: This product is saved as {formatType(inferredType as JewelleryType)}, but AI detected{' '}
          {formatType(analysis.jewelleryType)}.
        </p>
      )}
      {!hasComparableCategory && (
        <p className={styles.neutralNotice}>
          The existing product category doesn&apos;t map to a known jewellery type — pick one below.
        </p>
      )}

      <div className={styles.categoryActions}>
        <button
          type="button"
          className={sharedStyles.button}
          disabled={!hasComparableCategory}
          onClick={() => confirmWith(inferredType as JewelleryType)}
        >
          Keep Product Category
        </button>
        <button
          type="button"
          className={sharedStyles.button}
          disabled={!analysis || analysis.jewelleryType === 'UNKNOWN'}
          onClick={() => confirmWith(analysis!.jewelleryType)}
        >
          Use AI-Detected Category
        </button>
        <button
          type="button"
          className={sharedStyles.button}
          onClick={() => {
            onCategoryConfirmedChange(false);
            setIsPickingCategory((v) => !v);
          }}
        >
          Select Another Category
        </button>
      </div>

      {isPickingCategory && (
        <div className={styles.categoryPicker}>
          <input
            type="text"
            className={styles.categorySearch}
            placeholder="Search jewellery types…"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />
          <div className={styles.categoryGrid}>
            {filteredTypes.map((t) => (
              <button
                key={t}
                type="button"
                className={jewelleryType === t ? styles.categoryCardSelected : styles.categoryCard}
                onClick={() => confirmWith(t)}
              >
                {formatType(t)}
              </button>
            ))}
          </div>
        </div>
      )}

      {categoryConfirmed && jewelleryType && (
        <p className={styles.confirmedNotice}>
          ✓ Confirmed for this generation: <strong>{formatType(jewelleryType)}</strong>
        </p>
      )}

      {/* Customer category — WHO the piece is for, separate from jewellery
          type (WHAT it is). Follows the exact same AI-suggests / admin-
          corrects / admin-confirms pattern as the jewellery type above, on
          this same screen — Ring skips the Presenter step entirely and goes
          straight from here to generation, so this is the only place every
          jewellery type is guaranteed to pass through. Drives presenter
          selection automatically; no separate presenter-picker step is added
          for it. */}
      <section className={styles.generationPlan}>
        <h3 className={styles.generationPlanTitle}>Customer Category</h3>
        {analysis && (
          <div className={styles.attrCard}>
            <p className={styles.attrLabel}>AI-Suggested Customer Category</p>
            <p className={styles.attrValue}>{formatCustomerCategory(analysis.customerCategory)}</p>
            <span className={styles.confidence}>Confidence: {pct(analysis.customerCategoryConfidence)}</span>
          </div>
        )}

        <div className={styles.categoryActions}>
          <button
            type="button"
            className={sharedStyles.button}
            disabled={!analysis}
            onClick={() => analysis && confirmAudienceWith(analysis.customerCategory)}
          >
            Use Suggested Category
          </button>
          <button
            type="button"
            className={sharedStyles.button}
            onClick={() => {
              onCustomerCategoryConfirmedChange(false);
              setIsPickingAudience((v) => !v);
            }}
          >
            Select Another Category
          </button>
        </div>

        {isPickingAudience && (
          <div className={styles.categoryGrid}>
            {CUSTOMER_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={customerCategory === c ? styles.categoryCardSelected : styles.categoryCard}
                onClick={() => confirmAudienceWith(c)}
              >
                {formatCustomerCategory(c)}
              </button>
            ))}
          </div>
        )}

        {customerCategoryConfirmed && customerCategory && (
          <p className={styles.confirmedNotice}>
            ✓ Confirmed customer category: <strong>{formatCustomerCategory(customerCategory)}</strong>
            {presenterSummary && ` — ${presenterSummary}`}
          </p>
        )}
      </section>

      <section className={styles.generationPlan}>
        <h3 className={styles.generationPlanTitle}>Generation Plan</h3>
        <Toggle
          checked={generateRoseGold}
          onChange={onGenerateRoseGoldChange}
          disabled={isRoseGoldForced(jewelleryType)}
          label="Generate Rose Gold Version"
          helperText={
            isRoseGoldForced(jewelleryType)
              ? 'Always on for Necklace — 2 Yellow + 2 Rose catalogue images, plus 1 Yellow + 1 Rose presenter image when a presenter is selected.'
              : 'Creates Rose Gold catalogue and presenter images in addition to the Yellow Gold images.'
          }
        />
        {generationSummary && <p className={styles.confirmedNotice}>{generationSummary}</p>}
      </section>

      <section className={styles.generationPlan}>
        <Toggle
          checked={includeProductSizeImage}
          onChange={onIncludeProductSizeImageChange}
          label="Include Product Size Image"
          helperText="Generate a size-guide image using the product's actual measurements."
        />
      </section>
    </div>
  );
}
