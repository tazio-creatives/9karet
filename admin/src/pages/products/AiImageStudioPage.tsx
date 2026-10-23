import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStudioJob,
  fetchActiveStudioJob,
  fetchStudioJob,
  confirmStudioJob,
  retryStudioAsset,
  updateStudioAssetSelection,
  importStudioAsset,
  completeStudioImport,
  cancelStudioJob,
  changeGentsPresenter,
  type JewelleryType,
  type CustomerCategory,
  type PromptOverrides,
  type PromptCreativeOverride,
} from '../../api/aiStudio';
import { fetchAdminCategories } from '../../api/categories';
import { fetchAdminProduct } from '../../api/products';
import { fetchPresenters } from '../../api/presenters';
import { fetchProductSizeMeasurements } from '../../api/productSizeImage';
import { ApiError } from '../../api/client';
import { StudioStepper } from '../../features/aiStudio/StudioStepper';
import { UploadStep } from '../../features/aiStudio/UploadStep';
import { AnalyseConfirmStep } from '../../features/aiStudio/AnalyseConfirmStep';
import { ManualMeasurementsForm } from '../../features/aiStudio/ManualMeasurementsForm';
import { PresenterStep } from '../../features/aiStudio/PresenterStep';
import { ReviewPromptsStep } from '../../features/aiStudio/ReviewPromptsStep';
import { GenerateStep } from '../../features/aiStudio/GenerateStep';
import { ReviewImportStep } from '../../features/aiStudio/ReviewImportStep';
import {
  resolveAssetTypesForJob,
  inferJewelleryTypeFromCategory,
  isRoseGoldForced,
} from '../../features/aiStudio/generationRules';
import sharedStyles from '../../styles/shared.module.css';
import styles from './AiImageStudioPage.module.css';

// The admin's last Rose Gold choice, remembered as a device-local default
// for the next product (spec: "use it as the default for the next product,
// the administrator must still be able to change it for each product").
const ROSE_GOLD_PREF_KEY = 'aiStudio.defaultGenerateRoseGold';

export function AiImageStudioPage() {
  const { id: productId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  // Lets the product form's "N AI images not imported" banner deep-link
  // straight into a specific (possibly no-longer-"active") job — e.g. a
  // completed job that still has an unimported, validation-flagged asset.
  // Present only takes effect once; skips the active-job lookup entirely.
  const requestedJobId = searchParams.get('jobId');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [jobId, setJobId] = useState<string | null>(requestedJobId);
  const [hasCheckedActiveJob, setHasCheckedActiveJob] = useState(!!requestedJobId);
  const [confirmSubStep, setConfirmSubStep] = useState<'analyse' | 'measurements' | 'presenter' | 'prompts'>('analyse');
  // Default off (plan: "Include Product Size Image" toggle). A fully
  // decoupled generation pipeline from everything else on this page — see
  // productSizeImage.controller.js on the backend — so this state only ever
  // decides whether the 'measurements' sub-step appears in this wizard; it
  // is never sent as part of confirmStudioJob's payload.
  const [includeProductSizeImage, setIncludeProductSizeImage] = useState(false);
  const [jewelleryType, setJewelleryType] = useState<JewelleryType | ''>('');
  // Requires an explicit "Keep Product Category" / "Use AI-Detected
  // Category" / "Select Another Category" click before Continue unlocks —
  // even when jewelleryType already defaulted to the right value (Problem 1:
  // category confirmation must be a real, mandatory gate, not just a
  // pre-filled default the admin never had to look at).
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);
  // Mirrors jewelleryType/categoryConfirmed exactly — a mandatory,
  // explicitly-confirmed gate, not just a pre-filled default (same
  // rationale as Problem 1's category-confirmation audit trail).
  const [customerCategory, setCustomerCategory] = useState<CustomerCategory | ''>('');
  const [customerCategoryConfirmed, setCustomerCategoryConfirmed] = useState(false);
  const [generateRoseGold, setGenerateRoseGold] = useState(
    () => localStorage.getItem(ROSE_GOLD_PREF_KEY) !== 'false',
  );
  // Necklace always gets the Yellow + Rose set (see generationRules'
  // isRoseGoldForced) — the saved toggle preference only applies elsewhere.
  const effectiveRoseGold = isRoseGoldForced(jewelleryType) || generateRoseGold;
  const [presenterId, setPresenterId] = useState<string | null>(null);
  const [promptOverrides, setPromptOverrides] = useState<PromptOverrides>({});
  // A Set (not a single id) so "Regenerate All" — Ring-only — can show every
  // in-flight tile's own "Requesting…" state at once, not just the last one
  // clicked; individual regenerate still works exactly as before, just
  // adding/removing its own id from the set.
  const [regeneratingAssetIds, setRegeneratingAssetIds] = useState<Set<string>>(new Set());
  const isRing = jewelleryType === 'RING';

  const { data: productData } = useQuery({
    queryKey: ['admin-product', productId],
    queryFn: () => fetchAdminProduct(productId as string),
    enabled: !!productId,
  });
  const { data: categoriesData } = useQuery({ queryKey: ['admin-categories'], queryFn: fetchAdminCategories });
  const product = productData?.product ?? null;
  const productCategory = categoriesData?.categories.find((c) => c.id === product?.categoryId) ?? null;

  // Shares its cache with PresenterStep's identical query — only fetched
  // here for the presenter's display name on the Review Prompts panel.
  const { data: presentersData } = useQuery({
    queryKey: ['ai-studio-presenters'],
    queryFn: () => fetchPresenters(),
  });
  const presenters = presentersData?.presenters ?? [];

  const sizeMeasurementsQueryKey = ['product-size-measurements', productId];
  const { data: sizeMeasurementsData } = useQuery({
    queryKey: sizeMeasurementsQueryKey,
    queryFn: () => fetchProductSizeMeasurements(productId as string),
    enabled: !!productId,
    refetchInterval: (query) => (query.state.data?.generatedImage?.status === 'generating' ? 2000 : false),
  });

  // Resume an in-progress job for this product instead of always starting at
  // Upload — runs once on mount.
  useEffect(() => {
    if (!productId || hasCheckedActiveJob) return;
    fetchActiveStudioJob(productId)
      .then((res) => {
        if (res.jobId) setJobId(res.jobId);
      })
      .finally(() => setHasCheckedActiveJob(true));
  }, [productId, hasCheckedActiveJob]);

  const jobQueryKey = ['ai-studio-job', productId, jobId];
  const { data: jobData } = useQuery({
    queryKey: jobQueryKey,
    queryFn: () => fetchStudioJob(productId as string, jobId as string),
    enabled: !!productId && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.job.status;
      return status === 'analysing' || status === 'generating' ? 2000 : false;
    },
  });
  const job = jobData?.job ?? null;
  const invalidateJob = () => queryClient.invalidateQueries({ queryKey: jobQueryKey });

  // Once analysis lands, default the jewellery type used for generation to
  // whatever the product's own category implies — "Use Product Information"
  // is the default path, "Update Product Category" is the only way to
  // change it, and neither ever writes back to the product record itself.
  useEffect(() => {
    if (!job?.analysis || jewelleryType) return;
    const inferred = inferJewelleryTypeFromCategory(productCategory?.name ?? null);
    if (inferred) {
      setJewelleryType(inferred);
    } else if (job.analysis.jewelleryType !== 'UNKNOWN') {
      setJewelleryType(job.analysis.jewelleryType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.analysis, productCategory?.name]);

  // Same reasoning as the jewelleryType default-fill effect above — the AI's
  // suggested customer category pre-fills the field, but confirmation still
  // requires its own explicit click (see customerCategoryConfirmed).
  useEffect(() => {
    if (!job?.analysis || customerCategory) return;
    setCustomerCategory(job.analysis.customerCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.analysis]);

  const createMutation = useMutation({
    mutationFn: (files: File[]) => createStudioJob(productId as string, files),
    onSuccess: (res) => {
      setJobId(res.jobId);
      setConfirmSubStep('analyse');
      setCategoryConfirmed(false);
      setCustomerCategory('');
      setCustomerCategoryConfirmed(false);
      setPromptOverrides({});
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmStudioJob(productId as string, jobId as string, {
        jewelleryType: jewelleryType as Exclude<JewelleryType, 'UNKNOWN'>,
        categoryId: product?.categoryId ?? null,
        presenterId: isRing ? null : presenterId,
        generateRoseGold: effectiveRoseGold,
        promptOverrides,
        customerCategory: customerCategory || undefined,
      }),
    onSuccess: invalidateJob,
  });

  const retryMutation = useMutation({
    mutationFn: (assetId: string) => retryStudioAsset(productId as string, jobId as string, assetId),
  });

  function regenerateAsset(assetId: string) {
    setRegeneratingAssetIds((prev) => new Set(prev).add(assetId));
    retryMutation.mutate(assetId, {
      onSuccess: invalidateJob,
      onSettled: () =>
        setRegeneratingAssetIds((prev) => {
          const next = new Set(prev);
          next.delete(assetId);
          return next;
        }),
    });
  }

  function regenerateAllAssets(assetIds: string[]) {
    for (const assetId of assetIds) {
      if (!regeneratingAssetIds.has(assetId)) regenerateAsset(assetId);
    }
  }

  // "Change Gents Presenter" — the only action that creates a new master
  // identity after the first one exists for a job; marks both Gents
  // presenter tiles as regenerating together (mirrors regenerateAllAssets'
  // shape) since the backend regenerates them as a matched pair.
  const changeGentsPresenterMutation = useMutation({
    mutationFn: () => changeGentsPresenter(productId as string, jobId as string),
  });

  function handleChangeGentsPresenter(presenterAssetIds: string[]) {
    setRegeneratingAssetIds((prev) => {
      const next = new Set(prev);
      for (const id of presenterAssetIds) next.add(id);
      return next;
    });
    changeGentsPresenterMutation.mutate(undefined, {
      onSuccess: invalidateJob,
      onSettled: () =>
        setRegeneratingAssetIds((prev) => {
          const next = new Set(prev);
          for (const id of presenterAssetIds) next.delete(id);
          return next;
        }),
    });
  }

  const selectionMutation = useMutation({
    mutationFn: ({
      assetId,
      input,
    }: {
      assetId: string;
      input: { selected?: boolean; isFeatured?: boolean; validationAccepted?: boolean };
    }) => updateStudioAssetSelection(productId as string, jobId as string, assetId, input),
    onSuccess: invalidateJob,
  });

  // "Edit Prompt & Regenerate" (Review & Import, on a warning/failed asset):
  // persist the edited prompt first, then retry that one asset with it.
  const editPromptMutation = useMutation({
    mutationFn: async ({ assetId, override }: { assetId: string; override: PromptCreativeOverride }) => {
      await updateStudioAssetSelection(productId as string, jobId as string, assetId, {
        customCreativeInstructions: override,
      });
      setRegeneratingAssetIds((prev) => new Set(prev).add(assetId));
      return retryStudioAsset(productId as string, jobId as string, assetId);
    },
    onSuccess: invalidateJob,
    onSettled: (_data, _err, variables) =>
      setRegeneratingAssetIds((prev) => {
        const next = new Set(prev);
        next.delete(variables.assetId);
        return next;
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelStudioJob(productId as string, jobId as string),
    onSuccess: () => navigate(`/products/${productId}/edit`),
  });

  const createError = createMutation.error instanceof ApiError ? createMutation.error.message : null;
  const confirmError = confirmMutation.error instanceof ApiError ? confirmMutation.error.message : null;

  function handleGenerateRoseGoldChange(value: boolean) {
    setGenerateRoseGold(value);
    localStorage.setItem(ROSE_GOLD_PREF_KEY, String(value));
  }

  const generateCount = resolveAssetTypesForJob({ generateRoseGold: effectiveRoseGold, hasPresenter: !!presenterId, jewelleryType }).length;

  return (
    <div>
      <div className={styles.header}>
        <h1>AI Image Studio</h1>
        {job && !['completed', 'importing'].includes(job.status) && (
          <button type="button" className={sharedStyles.button} onClick={() => cancelMutation.mutate()}>
            Cancel
          </button>
        )}
      </div>
      <p className={styles.subtitle}>
        Upload jewellery reference photos and generate a catalogue image set for {product?.name ?? 'this product'}.
      </p>

      <StudioStepper status={job?.status ?? null} confirmSubStep={confirmSubStep} generateCount={generateCount} isRing={isRing} />

      <section className={sharedStyles.cardPadded}>
        {!job && (
          <UploadStep onSubmit={(files) => createMutation.mutate(files)} isPending={createMutation.isPending} error={createError} />
        )}

        {job && job.status === 'analysing' && <p>Analysing the reference photo…</p>}

        {job && job.status === 'awaiting_confirmation' && confirmSubStep === 'analyse' && (
          <>
            <AnalyseConfirmStep
              job={job}
              productName={product?.name ?? ''}
              productCategoryName={productCategory?.name ?? null}
              jewelleryType={jewelleryType}
              onJewelleryTypeChange={setJewelleryType}
              categoryConfirmed={categoryConfirmed}
              onCategoryConfirmedChange={setCategoryConfirmed}
              generateRoseGold={effectiveRoseGold}
              onGenerateRoseGoldChange={handleGenerateRoseGoldChange}
              customerCategory={customerCategory}
              onCustomerCategoryChange={setCustomerCategory}
              customerCategoryConfirmed={customerCategoryConfirmed}
              onCustomerCategoryConfirmedChange={setCustomerCategoryConfirmed}
              includeProductSizeImage={includeProductSizeImage}
              onIncludeProductSizeImageChange={setIncludeProductSizeImage}
            />
            {confirmError && isRing && <p className={sharedStyles.error}>{confirmError}</p>}
            <div className={styles.actions}>
              <button
                type="button"
                className={sharedStyles.buttonPrimary}
                disabled={
                  !jewelleryType ||
                  !categoryConfirmed ||
                  !customerCategoryConfirmed ||
                  (isRing && !includeProductSizeImage && confirmMutation.isPending)
                }
                // Ring skips both the presenter/hand-pose choice and the Review
                // Prompts screen entirely — generation starts immediately once
                // the category is confirmed, per spec: no pose selection, no
                // additional confirmation step in between. The new
                // measurements sub-step takes priority over both when the
                // toggle is on, for Ring and non-Ring jobs alike.
                onClick={() => {
                  if (includeProductSizeImage) {
                    setConfirmSubStep('measurements');
                    return;
                  }
                  if (isRing) {
                    confirmMutation.mutate();
                    return;
                  }
                  setConfirmSubStep('presenter');
                }}
              >
                {isRing && !includeProductSizeImage
                  ? confirmMutation.isPending
                    ? 'Starting…'
                    : `Confirm & Generate ${generateCount} Images`
                  : 'Continue'}
              </button>
            </div>
          </>
        )}

        {job && job.status === 'awaiting_confirmation' && confirmSubStep === 'measurements' && jewelleryType && (
          <>
            <ManualMeasurementsForm
              productId={productId as string}
              jewelleryType={jewelleryType}
              initial={sizeMeasurementsData?.measurements}
              onSaved={() => queryClient.invalidateQueries({ queryKey: sizeMeasurementsQueryKey })}
              onGenerating={() => {
                queryClient.invalidateQueries({ queryKey: sizeMeasurementsQueryKey });
                if (isRing) {
                  confirmMutation.mutate();
                } else {
                  setConfirmSubStep('presenter');
                }
              }}
              onCancel={() => setConfirmSubStep('analyse')}
            />
            {sizeMeasurementsData?.generatedImage && (
              <>
                <p className={styles.subtitle}>
                  Product Size Image status: {sizeMeasurementsData.generatedImage.status}
                  {sizeMeasurementsData.generatedImage.status === 'stale' && ' — Measurements changed — regeneration required'}
                  {sizeMeasurementsData.generatedImage.failureReason && ` — ${sizeMeasurementsData.generatedImage.failureReason}`}
                </p>
                {sizeMeasurementsData.generatedImage.imageUrl && (
                  <img
                    src={sizeMeasurementsData.generatedImage.imageUrl}
                    alt="Product Size Image preview"
                    style={{ display: 'block', width: 220, height: 220, objectFit: 'contain', marginTop: 10, border: '1px solid #e2e2e2', borderRadius: 8 }}
                  />
                )}
              </>
            )}
            <div className={styles.actions}>
              <button type="button" className={sharedStyles.button} onClick={() => setConfirmSubStep('analyse')}>
                Back
              </button>
              <button
                type="button"
                className={sharedStyles.buttonPrimary}
                onClick={() => (isRing ? confirmMutation.mutate() : setConfirmSubStep('presenter'))}
              >
                {isRing ? (confirmMutation.isPending ? 'Starting…' : `Confirm & Generate ${generateCount} Images`) : 'Continue'}
              </button>
            </div>
          </>
        )}

        {job && job.status === 'awaiting_confirmation' && confirmSubStep === 'presenter' && !isRing && (
          <>
            <PresenterStep
              jewelleryType={jewelleryType}
              presenterId={presenterId}
              onChange={setPresenterId}
              generateRoseGold={effectiveRoseGold}
            />
            <div className={styles.actions}>
              <button type="button" className={sharedStyles.button} onClick={() => setConfirmSubStep('analyse')}>
                Back
              </button>
              <button
                type="button"
                className={sharedStyles.buttonPrimary}
                onClick={() => setConfirmSubStep('prompts')}
              >
                Continue to Review Prompts
              </button>
            </div>
          </>
        )}

        {job && job.status === 'awaiting_confirmation' && confirmSubStep === 'prompts' && jewelleryType && !isRing && (
          <>
            <ReviewPromptsStep
              productId={productId as string}
              jobId={jobId as string}
              jewelleryType={jewelleryType as Exclude<JewelleryType, 'UNKNOWN'>}
              presenterId={presenterId}
              presenterName={presenters.find((p) => p.id === presenterId)?.displayName ?? null}
              generateRoseGold={effectiveRoseGold}
              promptOverrides={promptOverrides}
              onPromptOverridesChange={setPromptOverrides}
              customerCategory={customerCategory}
            />
            {confirmError && <p className={sharedStyles.error}>{confirmError}</p>}
            <div className={styles.actions}>
              <button type="button" className={sharedStyles.button} onClick={() => setConfirmSubStep('presenter')}>
                Back
              </button>
              <button
                type="button"
                className={sharedStyles.buttonPrimary}
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
              >
                {confirmMutation.isPending ? 'Starting…' : `Confirm & Generate ${generateCount} Images`}
              </button>
            </div>
          </>
        )}

        {job && job.status === 'generating' && (
          <GenerateStep
            assets={job.assets}
            jewelleryType={job.jewelleryType}
            generateRoseGold={job.generateRoseGold}
            onRegenerate={regenerateAsset}
            regeneratingAssetIds={regeneratingAssetIds}
          />
        )}

        {job && ['review_ready', 'partially_failed', 'importing', 'completed'].includes(job.status) && (
          <ReviewImportStep
            job={job}
            onRegenerate={regenerateAsset}
            onRegenerateAll={regenerateAllAssets}
            onChangeGentsPresenter={handleChangeGentsPresenter}
            isChangingGentsPresenter={changeGentsPresenterMutation.isPending}
            regeneratingAssetIds={regeneratingAssetIds}
            onToggleSelected={(assetId, selected) => selectionMutation.mutate({ assetId, input: { selected } })}
            onSetFeatured={(assetId) => selectionMutation.mutate({ assetId, input: { isFeatured: true } })}
            onAcceptValidation={(assetId) => selectionMutation.mutate({ assetId, input: { validationAccepted: true } })}
            onEditPromptAndRegenerate={(assetId, override) => editPromptMutation.mutate({ assetId, override })}
            importAsset={async (assetId) => {
              await importStudioAsset(productId as string, jobId as string, assetId);
              await invalidateJob();
            }}
            completeImport={async () => {
              await completeStudioImport(productId as string, jobId as string);
              queryClient.invalidateQueries({ queryKey: ['admin-product-images', productId] });
            }}
            onImportComplete={() => navigate(`/products/${productId}/edit`)}
            onSaveAsDraft={() => navigate(`/products/${productId}/edit`)}
          />
        )}

        {job && job.status === 'failed' && <p className={sharedStyles.error}>Generation failed: {job.error}</p>}
        {job && job.status === 'cancelled' && <p>This job was cancelled.</p>}
      </section>
    </div>
  );
}
