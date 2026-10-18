import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPricingRule,
  createPricingRule,
  updatePricingRule,
  previewPricingRule as previewPricingRuleApi,
} from '../../api/pricingRules';
import { fetchAdminProducts, fetchAdminProduct } from '../../api/products';
import { fetchStoneTypes } from '../../api/stoneTypes';
import { CategoryTreeSelect } from '../../components/CategoryTreeSelect';
import { MultiSelect, type MultiSelectOption } from '../../components/MultiSelect';
import { DateTimeField } from '../../components/DateTimeField';
import { RulePreviewPanel } from './RulePreviewPanel';
import { ApiError } from '../../api/client';
import type {
  PricingRuleInput,
  PricingRuleType,
  PricingDiscountType,
  PricingOverrideMode,
  PricingRuleScope,
  PricingRuleStatus,
  PricingRuleCondition,
} from '../../api/types';
import sharedStyles from '../../styles/shared.module.css';
import styles from './pricing.module.css';

interface RuleFormPageProps {
  ruleType: PricingRuleType;
}

const DISCOUNT_TYPE_OPTIONS: Record<PricingRuleType, { value: PricingDiscountType; label: string }[]> = {
  MAKING_CHARGE: [
    { value: 'PERCENT', label: 'Percent (%)' },
    { value: 'FIXED_AMOUNT', label: 'Fixed Amount (₹)' },
  ],
  STONE: [
    { value: 'PERCENT', label: 'Percent (%)' },
    { value: 'FIXED_AMOUNT', label: 'Fixed Amount (₹)' },
    { value: 'FIXED_AMOUNT_PER_CARAT', label: 'Fixed Amount per Carat (₹)' },
  ],
};

const RULE_TYPE_LABEL: Record<PricingRuleType, string> = {
  MAKING_CHARGE: 'Making Charge Rule',
  STONE: 'Stone Discount Rule',
};

const LIST_ROUTE: Record<PricingRuleType, string> = {
  MAKING_CHARGE: '/pricing/making-charge-rules',
  STONE: '/pricing/stone-rules',
};

async function loadProductOptions(query: string): Promise<MultiSelectOption[]> {
  const res = await fetchAdminProducts({ search: query || undefined, limit: 20 });
  return res.products.map((p) => ({ id: p.id, label: `${p.name} (${p.slug})` }));
}

export function RuleFormPage({ ruleType }: RuleFormPageProps) {
  const { ruleId } = useParams<{ ruleId: string }>();
  const isEdit = !!ruleId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: ruleData, isLoading: isRuleLoading } = useQuery({
    queryKey: ['pricing-rule', ruleId],
    queryFn: () => fetchPricingRule(ruleId as string),
    enabled: isEdit,
  });

  const { data: stoneTypesData } = useQuery({
    queryKey: ['admin-stone-types-active'],
    queryFn: () => fetchStoneTypes({ activeOnly: true }),
    enabled: ruleType === 'STONE',
  });

  const [name, setName] = useState('');
  const [scope, setScope] = useState<PricingRuleScope>('GLOBAL');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productLabels, setProductLabels] = useState<Record<string, string>>({});
  const [discountType, setDiscountType] = useState<PricingDiscountType>('PERCENT');
  const [discountValue, setDiscountValue] = useState('');
  const [overrideMode, setOverrideMode] = useState<PricingOverrideMode>('PRESERVE');
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [status, setStatus] = useState<PricingRuleStatus>('DRAFT');
  const [priority, setPriority] = useState('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // STONE-only fields. No stone types selected = every stone type.
  const [stoneTypeIds, setStoneTypeIds] = useState<string[]>([]);
  const [caratMin, setCaratMin] = useState('');
  const [caratMax, setCaratMax] = useState('');

  // Populate the form once the saved rule loads. Product chip labels aren't
  // part of the rule DTO (it only stores ids) — fetched individually since a
  // PRODUCT-scope rule's list is a hand-picked, typically small set.
  useEffect(() => {
    if (!ruleData) return;
    const r = ruleData.rule;
    setName(r.name);
    setScope(r.scope);
    setCategoryIds(r.categoryIds);
    setProductIds(r.productIds);
    setDiscountType(r.discountType);
    setDiscountValue(String(r.discountValue));
    setOverrideMode(r.overrideMode);
    setStartsAt(r.startsAt);
    setEndsAt(r.endsAt);
    setStatus(r.status === 'EXPIRED' ? 'DISABLED' : r.status);
    setPriority(String(r.priority));
    setNotes(r.notes ?? '');

    const caratCondition = r.conditions.find((c) => c.conditionType === 'CARAT_RANGE');
    setStoneTypeIds(r.stoneTypeIds);
    setCaratMin(caratCondition?.minValue != null ? String(caratCondition.minValue) : '');
    setCaratMax(caratCondition?.maxValue != null ? String(caratCondition.maxValue) : '');

    if (r.productIds.length > 0) {
      Promise.all(r.productIds.map((id) => fetchAdminProduct(id).then((res) => [id, res.product.name] as const)))
        .then((pairs) => setProductLabels(Object.fromEntries(pairs)))
        .catch(() => {});
    }
  }, [ruleData]);

  function buildConditions(): PricingRuleCondition[] {
    if (ruleType !== 'STONE') return [];
    const conditions: PricingRuleCondition[] = [];
    if (caratMin !== '' || caratMax !== '') {
      conditions.push({
        conditionType: 'CARAT_RANGE',
        stringValues: null,
        minValue: caratMin !== '' ? Number(caratMin) : null,
        maxValue: caratMax !== '' ? Number(caratMax) : null,
      });
    }
    return conditions;
  }

  function buildInput(): PricingRuleInput {
    return {
      ruleType,
      name: name.trim(),
      scope,
      discountType,
      discountValue: Number(discountValue) || 0,
      // Every product is 9K, so a rule never needs narrowing by purity.
      purityScope: 'ALL',
      purityValueIds: [],
      overrideMode: scope === 'PRODUCT' ? 'PRESERVE' : overrideMode,
      startsAt,
      endsAt,
      status,
      priority: Number(priority) || 0,
      notes: notes.trim() || null,
      categoryIds: scope === 'CATEGORY' ? categoryIds : [],
      productIds: scope === 'PRODUCT' ? productIds : [],
      stoneTypeIds: ruleType === 'STONE' ? stoneTypeIds : [],
      conditions: buildConditions(),
    };
  }

  const currentInput = buildInput();
  const currentInputJson = JSON.stringify(currentInput);

  const previewMutation = useMutation({ mutationFn: (input: PricingRuleInput) => previewPricingRuleApi(input) });
  const [previewedInputJson, setPreviewedInputJson] = useState<string | null>(null);
  const isPreviewStale = previewedInputJson !== currentInputJson;

  const canPreview =
    name.trim().length > 0 &&
    discountValue !== '' &&
    Number(discountValue) >= 0 &&
    (scope !== 'CATEGORY' || categoryIds.length > 0) &&
    (scope !== 'PRODUCT' || productIds.length > 0);

  function runPreview() {
    previewMutation.mutate(currentInput, {
      onSuccess: () => setPreviewedInputJson(currentInputJson),
      onError: () => setPreviewedInputJson(null),
    });
  }

  const createMutation = useMutation({ mutationFn: (input: PricingRuleInput) => createPricingRule(input) });
  const updateMutation = useMutation({
    mutationFn: (input: Partial<PricingRuleInput>) => updatePricingRule(ruleId as string, input),
  });
  const isSaving = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!previewMutation.data || isPreviewStale) {
      setError('Preview this rule’s impact with your current changes before saving.');
      return;
    }
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(currentInput);
      } else {
        await createMutation.mutateAsync(currentInput);
      }
      await queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
      navigate(LIST_ROUTE[ruleType]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this rule.');
    }
  }

  if (isEdit && isRuleLoading) return <p className={sharedStyles.empty}>Loading…</p>;

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>
          {isEdit ? `Edit ${RULE_TYPE_LABEL[ruleType]}` : `New ${RULE_TYPE_LABEL[ruleType]}`}
        </h2>
        <Link to={LIST_ROUTE[ruleType]} className={sharedStyles.buttonLink}>
          ← Back to list
        </Link>
      </div>

      <form onSubmit={handleSubmit} className={sharedStyles.cardPadded}>
        <div className={styles.ruleForm}>
          <label className={`${sharedStyles.field} ${styles.fieldFull}`}>
            Rule Name
            <input
              className={styles.formControl}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                ruleType === 'STONE' ? 'e.g. Ruby Week — 20% off Ruby' : 'e.g. Festive Season — 15% off Making Charges on Rings'
              }
              required
            />
          </label>

          <p className={styles.sectionLabel}>Scope</p>
          <div className={`${styles.radioRow} ${styles.fieldFull}`}>
            {(['GLOBAL', 'CATEGORY', 'PRODUCT'] as PricingRuleScope[]).map((s) => (
              <label key={s} className={styles.radioOption}>
                <input type="radio" name="scope" checked={scope === s} onChange={() => setScope(s)} />
                <span>
                  <strong>{s === 'GLOBAL' ? 'Global' : s === 'CATEGORY' ? 'Category' : 'Specific Products'}</strong>
                  <span>
                    {s === 'GLOBAL' && 'Every product in the catalogue'}
                    {s === 'CATEGORY' && 'Products under one or more categories'}
                    {s === 'PRODUCT' && 'A hand-picked list of products'}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {scope === 'CATEGORY' && (
            <div className={styles.fieldFull}>
              <label className={sharedStyles.field}>
                Categories
                <CategoryTreeSelect values={categoryIds} onChange={setCategoryIds} />
              </label>
            </div>
          )}
          {scope === 'PRODUCT' && (
            <div className={styles.fieldFull}>
              <label className={sharedStyles.field}>
                Products
                <MultiSelect
                  values={productIds}
                  selectedLabels={productLabels}
                  onChange={(values, labels) => {
                    setProductIds(values);
                    setProductLabels(labels);
                  }}
                  loadOptions={loadProductOptions}
                  placeholder="Search products by name…"
                />
              </label>
            </div>
          )}

          <hr className={styles.sectionDivider} />
          <p className={styles.sectionLabel}>Discount</p>

          <label className={sharedStyles.field}>
            Discount Type
            <select
              className={styles.formControl}
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as PricingDiscountType)}
            >
              {DISCOUNT_TYPE_OPTIONS[ruleType].map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className={sharedStyles.field}>
            Discount Value{' '}
            {discountType === 'PERCENT' ? '(%, max 100)' : discountType === 'FIXED_AMOUNT_PER_CARAT' ? '(₹/carat)' : '(₹)'}
            <input
              className={styles.formControl}
              type="number"
              min="0"
              max={discountType === 'PERCENT' ? 100 : undefined}
              step="0.01"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              required
            />
          </label>

          {ruleType === 'STONE' && (
            <>
              <hr className={styles.sectionDivider} />
              <p className={styles.sectionLabel}>Filters (optional)</p>
              <div className={styles.fieldFull}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  Stone Types — leave all unticked to apply to every stone
                </span>
                <div className={styles.radioRow} style={{ flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 6 }}>
                  {(stoneTypesData?.stoneTypes ?? []).map((t) => (
                    <label key={t.id} className={styles.radioOption} style={{ gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={stoneTypeIds.includes(t.id)}
                        onChange={() =>
                          setStoneTypeIds((prev) => (prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]))
                        }
                      />
                      <strong style={{ fontWeight: 500 }}>{t.name}</strong>
                    </label>
                  ))}
                  {(stoneTypesData?.stoneTypes ?? []).length === 0 && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)' }}>
                      No stone types configured yet.
                    </span>
                  )}
                </div>
              </div>

              <label className={sharedStyles.field}>
                Stone Weight per Line (ct) — Min
                <input
                  className={styles.formControl}
                  type="number"
                  min="0"
                  step="0.01"
                  value={caratMin}
                  onChange={(e) => setCaratMin(e.target.value)}
                />
              </label>
              <label className={sharedStyles.field}>
                Stone Weight per Line (ct) — Max
                <input
                  className={styles.formControl}
                  type="number"
                  min="0"
                  step="0.01"
                  value={caratMax}
                  onChange={(e) => setCaratMax(e.target.value)}
                />
              </label>
            </>
          )}

          {scope !== 'PRODUCT' && (
            <>
              <hr className={styles.sectionDivider} />
              <p className={styles.sectionLabel}>Existing Product Overrides</p>
              <div className={`${styles.radioRow} ${styles.fieldFull}`}>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="overrideMode"
                    checked={overrideMode === 'PRESERVE'}
                    onChange={() => setOverrideMode('PRESERVE')}
                  />
                  <span>
                    <strong>Preserve (recommended)</strong>
                    <span>Products with their own individual discount keep it — this rule never overrides them.</span>
                  </span>
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="overrideMode"
                    checked={overrideMode === 'SUPPRESS'}
                    onChange={() => setOverrideMode('SUPPRESS')}
                  />
                  <span>
                    <strong>Suppress while active</strong>
                    <span>
                      This rule reaches every product in scope, even ones with their own discount — automatically
                      reverts the moment this rule is disabled, expires, or is deleted.
                    </span>
                  </span>
                </label>
              </div>
            </>
          )}

          <hr className={styles.sectionDivider} />
          <p className={styles.sectionLabel}>Schedule &amp; Status</p>

          <DateTimeField label="Starts At (optional)" value={startsAt} onChange={setStartsAt} hint="Leave blank to start as soon as it's Active." />
          <DateTimeField label="Ends At (optional)" value={endsAt} onChange={setEndsAt} hint="Leave blank for no automatic expiry." />

          <label className={sharedStyles.field}>
            Status
            <select className={styles.formControl} value={status} onChange={(e) => setStatus(e.target.value as PricingRuleStatus)}>
              <option value="DRAFT">Draft — not applied yet</option>
              <option value="SCHEDULED">Scheduled — starts automatically at Starts At</option>
              <option value="ACTIVE">Active — applies immediately</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </label>
          <label className={sharedStyles.field}>
            Priority
            <input
              className={styles.formControl}
              type="number"
              step="1"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </label>
          <p className={styles.helpText}>Higher priority wins when two rules of the same scope both match a product.</p>

          <label className={`${sharedStyles.field} ${styles.fieldFull}`}>
            Notes (optional)
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note for other admins — not shown to customers."
            />
          </label>
        </div>

        <div style={{ marginTop: 'var(--space-5)' }}>
          <RulePreviewPanel
            ruleType={ruleType}
            overrideModeIsSuppress={overrideMode === 'SUPPRESS'}
            result={previewMutation.data}
            isLoading={previewMutation.isPending}
            isStale={isPreviewStale}
            error={previewMutation.isError ? (previewMutation.error instanceof ApiError ? previewMutation.error.message : 'Could not compute preview.') : null}
            canPreview={canPreview}
            onRunPreview={runPreview}
          />
        </div>

        {error && (
          <p className={sharedStyles.error} style={{ marginTop: 'var(--space-4)' }}>
            {error}
          </p>
        )}

        <div className={sharedStyles.formActions}>
          <button type="submit" className={`${sharedStyles.buttonPrimary} ${styles.actionButton}`} disabled={isSaving}>
            {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Rule'}
          </button>
          <Link to={LIST_ROUTE[ruleType]} className={`${sharedStyles.button} ${styles.actionButton}`}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
