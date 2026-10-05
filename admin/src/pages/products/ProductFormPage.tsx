import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminProduct,
  createProduct,
  updateProduct,
  setPriceLock,
} from '../../api/products';
import { fetchProductImages } from '../../api/productImages';
import { fetchStudioPendingReview } from '../../api/aiStudio';
import { fetchAdminCategories } from '../../api/categories';
import { fetchAdminCollections } from '../../api/collections';
import { previewPricing } from '../../api/pricing';
import { fetchDiamondConfigs } from '../../api/diamondConfigs';
import { fetchWeightRules } from '../../api/weightRules';
import { fetchPurityPricingRules } from '../../api/purityPricingRules';
import { ProductSizeImagePanel } from '../../features/aiStudio/ProductSizeImagePanel';
import type {
  GoldColor,
  MetalType,
  PricingPreviewResult,
  ProductInput,
  ProductStatus,
  Purity,
  PurityPricingRuleInput,
  VariantOverrideInput,
  WeightRulesInput,
} from '../../api/types';
import { ApiError } from '../../api/client';
import { formatPrice } from '../../utils/formatPrice';
import { ProductGallery } from '../../features/products/ProductGallery';
import { VariantMatrixEditor } from '../../features/products/VariantMatrixEditor';
import { OptionChipRow } from '../../features/products/OptionChipRow';
import { AdvancedVariantSummary } from '../../features/products/AdvancedVariantSummary';
import { AvailabilityRules } from '../../features/products/AvailabilityRules';
import { WeightDefaults } from '../../features/products/WeightDefaults';
import { PurityPricingRules } from '../../features/products/PurityPricingRules';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import pv from '../../features/products/ProductVariations.module.css';
import sharedStyles from '../../styles/shared.module.css';
import styles from './ProductFormPage.module.css';

const METAL_TYPES: MetalType[] = ['GOLD', 'PLATINUM'];
const PURITIES: Purity[] = ['9K', '14K', '18K', '22K', '24K'];
const GOLD_COLORS: { value: GoldColor; label: string }[] = [
  { value: 'YELLOW', label: 'Yellow Gold' },
  { value: 'ROSE', label: 'Rose Gold' },
  { value: 'WHITE', label: 'White Gold' },
];
const STATUSES: ProductStatus[] = ['DRAFT', 'AI_PROCESSING', 'AI_READY', 'PUBLISHED', 'FAILED'];
const GOLD_COLOR_LABELS: Record<GoldColor, string> = Object.fromEntries(
  GOLD_COLORS.map((c) => [c.value, c.label]),
) as Record<GoldColor, string>;

const EMPTY_FORM: ProductInput = {
  name: '',
  sku: '',
  categoryId: null,
  collectionId: null,
  shortDescription: '',
  fullDescription: '',
  metalType: 'GOLD',
  purity: '18K',
  goldColor: null,
  goldWeightGrams: null,
  diamondWeightGrams: null,
  diamondWeightCarats: null,
  diamondConfigId: null,
  diamondCount: null,
  diamondTypeId: null,
  diamondType: '',
  diamondColour: '',
  diamondClarity: '',
  gemstone: '',
  certification: '',
  productSize: '',
  sizeLabel: '',
  careInstructions: '',
  sizes: [],
  goldColors: [],
  purities: [],
  diamondConfigIds: [],
  makingCharge: 0,
  gstPercent: 3,
  mrp: 0,
  sellingPrice: 0,
  stockQuantity: 0,
  status: 'DRAFT',
  showDeliveryChecker: true,
  isNonReturnable: false,
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
};

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: productData, isLoading: isProductLoading } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => fetchAdminProduct(id as string),
    enabled: isEditing,
  });
  // Hydrates the Weight Defaults / Purity Pricing Rules draft state below —
  // these standalone GET endpoints are kept (other tooling may still read
  // them) but are only used here to seed the controlled form on load; saving
  // happens exclusively through the one combined Save Product action.
  const { data: weightRulesData } = useQuery({
    queryKey: ['admin-weight-rules', id],
    queryFn: () => fetchWeightRules(id as string),
    enabled: isEditing,
  });
  const { data: purityPricingRulesData } = useQuery({
    queryKey: ['admin-purity-pricing-rules', id],
    queryFn: () => fetchPurityPricingRules(id as string),
    enabled: isEditing,
  });
  // Same query key ProductGallery uses below, so this shares its cache
  // instead of firing a second request — only here to gate Save on "at
  // least one image", the one thing besides name that's still required.
  const { data: imagesData } = useQuery({
    queryKey: ['admin-product-images', id],
    queryFn: () => fetchProductImages(id as string),
    enabled: isEditing,
  });
  // Surfaces a finished AI Studio job that still has an image nobody
  // accepted/imported (most often auto-deselected by validation, then the
  // admin navigated away from Review & Import before dealing with it) — the
  // job itself may already be "completed", so it wouldn't otherwise show up
  // anywhere in the admin once this page is left.
  const { data: pendingReviewData } = useQuery({
    queryKey: ['ai-studio-pending-review', id],
    queryFn: () => fetchStudioPendingReview(id as string),
    enabled: isEditing,
  });
  const pendingReviewJob = pendingReviewData?.job ?? null;
  const { data: categoriesData } = useQuery({ queryKey: ['admin-categories'], queryFn: fetchAdminCategories });
  const { data: collectionsData } = useQuery({ queryKey: ['admin-collections'], queryFn: fetchAdminCollections });
  const { data: diamondConfigsData } = useQuery({
    queryKey: ['admin-diamond-configs-active'],
    queryFn: () => fetchDiamondConfigs({ activeOnly: true }),
  });

  const [form, setForm] = useState<ProductInput>(EMPTY_FORM);
  const [preview, setPreview] = useState<PricingPreviewResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept separate from the page-level `error` (shown far below, near Save)
  // so a failed auto-preview — e.g. diamond carat entered before diamond
  // quality is picked — is visible right where the admin is looking,
  // instead of silently leaving the price at ₹0 with no explanation.
  const [pricingError, setPricingError] = useState<string | null>(null);
  // Same reasoning as pricingError — "Start AI Generation" clicked with no
  // name entered used to fail silently from the admin's point of view (the
  // error rendered only in the page-level banner at the very bottom, far
  // from the Product Images section and the button that was just clicked).
  const [imageSourceError, setImageSourceError] = useState<string | null>(null);
  // Making Charge is entered as a % of gold value, not a flat rupee amount —
  // form.makingCharge (the flat figure the API actually stores/uses) is kept
  // in sync below whenever this percent or the live gold value changes.
  const [makingChargePercent, setMakingChargePercent] = useState<number | ''>(0);
  // Only populated/used on the Add Product (create) flow — lets the same
  // save that picks Gold Colors/Purities/Diamond Qualities/Sizes also set
  // starting stock + optional weight override per exact combination, so a
  // brand-new product can be fully configured in one step instead of a
  // separate trip into the per-product variant editor afterward.
  const [variantOverrides, setVariantOverrides] = useState<VariantOverrideInput[]>([]);
  // Weight Defaults / Purity Pricing Rules draft state — owned here, not by
  // the two section components, so they can render from the form's own
  // unsaved purities/sizes and be submitted through the single Save Product
  // action instead of each having its own save button/endpoint call.
  const [weightRules, setWeightRules] = useState<WeightRulesInput>({ purityRules: [], puritySizeRules: [] });
  const [purityPricingRules, setPurityPricingRules] = useState<PurityPricingRuleInput[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Removing a purity/size that the LOADED product already had saved data
  // for (weight/pricing rules, real variants with stock) is destructive —
  // confirmed before the draft state is actually changed, mirroring the
  // existing "switch to Fixed Product" confirmation below.
  const [pendingRemoval, setPendingRemoval] = useState<
    { type: 'purity'; value: Purity } | { type: 'size'; index: number; label: string } | null
  >(null);
  const variationsSectionRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const diamondConfigNames = Object.fromEntries(
    (diamondConfigsData?.diamondConfigs ?? []).map((c) => [c.id, c.name]),
  );
  // 'fixed' = one configuration only (no axes checked). 'selectable' = at
  // least one axis is offered. Purely a UI framing over the same
  // goldColors/purities/diamondConfigIds/sizes arrays the API already
  // takes — synced from loaded product data below, defaults to
  // 'selectable' for a brand-new product (nothing to hide yet).
  const [variationMode, setVariationMode] = useState<'fixed' | 'selectable'>('selectable');
  const [matrixExpanded, setMatrixExpanded] = useState(false);
  const [pendingFixedSwitch, setPendingFixedSwitch] = useState(false);

  function hasAnyAxis(f: ProductInput) {
    return (
      (f.goldColors?.length ?? 0) > 0 ||
      (f.purities?.length ?? 0) > 0 ||
      (f.diamondConfigIds?.length ?? 0) > 0 ||
      (f.sizes?.length ?? 0) > 0
    );
  }

  function confirmSwitchToFixed() {
    setForm((f) => ({ ...f, goldColors: [], purities: [], diamondConfigIds: [], sizes: [] }));
    setVariantOverrides([]);
    setVariationMode('fixed');
    setPendingFixedSwitch(false);
  }

  useEffect(() => {
    if (productData) {
      const p = productData.product;
      setForm({
        name: p.name,
        sku: p.sku,
        categoryId: p.categoryId,
        collectionId: p.collectionId,
        shortDescription: p.shortDescription ?? '',
        fullDescription: p.fullDescription ?? '',
        metalType: p.metalType,
        purity: p.purity,
        goldColor: p.goldColor,
        goldWeightGrams: p.goldWeightGrams,
        diamondWeightGrams: p.diamondWeightGrams,
        diamondWeightCarats: p.diamondWeightCarats,
        diamondConfigId: p.diamondConfigId,
        diamondCount: p.diamondCount,
        diamondTypeId: p.diamondTypeId,
        diamondType: p.diamondType ?? '',
        diamondColour: p.diamondColour ?? '',
        diamondClarity: p.diamondClarity ?? '',
        gemstone: p.gemstone ?? '',
        certification: p.certification ?? '',
        productSize: p.productSize ?? '',
        sizeLabel: p.sizeLabel ?? '',
        careInstructions: p.careInstructions ?? '',
        sizes: p.sizes.map((s) => ({
          label: s.label,
          stockQuantity: s.stockQuantity,
          weightGrams: s.weightGrams,
          diamondWeightCarats: s.diamondWeightCarats,
        })),
        goldColors: p.goldColorOptions,
        purities: p.purityOptions,
        diamondConfigIds: p.diamondOptions.map((d) => d.id),
        goldValue: p.priceBreakup.goldValue,
        // Load the pre-offer originals, not the (possibly discounted)
        // priceBreakup.diamondValue/makingCharge/sellingPrice — otherwise
        // re-saving a product with an active offer would bake the
        // discounted figures in as the new base and compound the discount
        // further on the next read.
        diamondValue: p.priceBreakup.diamondValueOriginal,
        makingCharge: p.priceBreakup.makingChargeOriginal,
        gstPercent: p.gstPercent,
        mrp: p.mrp,
        sellingPrice: p.sellingPriceOriginal,
        makingChargeDiscountPercent: p.priceBreakup.makingChargeDiscountPercent || undefined,
        diamondDiscountPercent: p.priceBreakup.diamondDiscountPercent || undefined,
        stockQuantity: p.stockQuantity,
        status: p.status,
        showDeliveryChecker: p.showDeliveryChecker,
        isNonReturnable: p.isNonReturnable ?? false,
        metaTitle: p.metaTitle ?? '',
        metaDescription: p.metaDescription ?? '',
        metaKeywords: p.metaKeywords ?? '',
      });
      setMakingChargePercent(p.makingChargePercent ?? 0);
      setVariationMode(
        p.goldColorOptions.length || p.purityOptions.length || p.diamondOptions.length || p.sizes.length
          ? 'selectable'
          : 'fixed',
      );
    }
  }, [productData]);

  // Seeds the Weight Defaults / Purity Pricing Rules draft state from the
  // saved rules once, on load — WeightDefaults/PurityPricingRules then own
  // reconciling their own local text drafts as the admin edits purities/
  // sizes/values (see their own axis-keyed useEffect). Only the SAVED
  // override fields are used (not the resolved "effective" values the
  // standalone GET endpoints also return) — editing must show what's
  // actually stored, not a pre-resolved default.
  useEffect(() => {
    if (!weightRulesData) return;
    setWeightRules({
      purityRules: weightRulesData.rules
        .filter((r) => r.sizeLabel == null)
        .map((r) => ({ purity: r.purity, goldWeightGrams: r.goldWeightGrams })),
      puritySizeRules: weightRulesData.rules
        .filter((r): r is typeof r & { sizeLabel: string } => r.sizeLabel != null)
        .map((r) => ({ purity: r.purity, sizeLabel: r.sizeLabel, goldWeightGrams: r.goldWeightGrams })),
    });
  }, [weightRulesData]);

  useEffect(() => {
    if (!purityPricingRulesData) return;
    setPurityPricingRules(
      purityPricingRulesData.rules.map((r) => ({
        purity: r.purity,
        makingChargePercent: r.makingChargePercent,
        makingChargeDiscountPercent: r.makingChargeDiscountPercent,
        diamondDiscountPercent: r.diamondDiscountPercent,
      })),
    );
  }, [purityPricingRulesData]);

  // A bare "Validation failed" (the generic message for any Zod rejection)
  // gives no clue which field caused it — append the specific field errors
  // the API already sends back but this page used to discard.
  function describeError(err: unknown, fallback: string): string {
    if (!(err instanceof ApiError)) return fallback;
    if (err.fields?.length) {
      return `${err.message}: ${err.fields.map((f) => `${f.path} — ${f.message}`).join('; ')}`;
    }
    return err.message;
  }

  function set<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Shared by every path that sends `form` to the API (Save, and the two
  // early-create shortcuts below) — without this, a blank size row (e.g.
  // "+ Add Size" clicked and left empty) passes fine on Save but throws a
  // raw Zod "Validation failed" from the quicker "Start AI Generation" /
  // "Start Manual Upload" buttons, which used to send `form` unsanitized.
  function buildPayload(overrides: Partial<ProductInput> = {}): ProductInput {
    return {
      ...form,
      name: form.name.trim(),
      sku: form.sku.trim() || `DRAFT-${Date.now()}`,
      // A cleared field is `undefined` in form state (keeps the input
      // visually blank while editing) — but JSON.stringify drops undefined
      // keys entirely, and updateProduct only writes columns whose key is
      // actually present in the request body. Left as undefined here,
      // clearing any of these back to "none" would silently leave the old
      // value in the database untouched. Default at the save boundary only,
      // once the admin's editing is done — mrp/discounts fall back to 0
      // ("no MRP" / "no offer"), gstPercent to the same 3 the form itself
      // starts a brand-new product at (there's no sensible "no GST").
      // The % is the source of truth going forward (live-recomputed on the
      // storefront as gold value moves) — form.makingCharge above is still
      // sent too, as the cached flat figure at today's gold value/purity.
      makingChargePercent: makingChargePercent === '' ? 0 : makingChargePercent,
      makingChargeDiscountPercent: form.makingChargeDiscountPercent ?? 0,
      diamondDiscountPercent: form.diamondDiscountPercent ?? 0,
      mrp: form.mrp ?? 0,
      gstPercent: form.gstPercent ?? 3,
      shortDescription: form.shortDescription || null,
      fullDescription: form.fullDescription || null,
      // diamondType (free text) is derived server-side from diamondTypeId now
      // (productsService.js's syncDiamondTypeName) — no longer sent directly.
      diamondTypeId: form.diamondTypeId || null,
      diamondColour: form.diamondColour || null,
      diamondClarity: form.diamondClarity || null,
      gemstone: form.gemstone || null,
      certification: form.certification || null,
      productSize: form.productSize || null,
      sizeLabel: form.sizeLabel || null,
      careInstructions: form.careInstructions || null,
      sizes: (form.sizes ?? []).filter((s) => s.label.trim().length > 0),
      ...(!isEditing && variantOverrides.length > 0 ? { variantOverrides } : {}),
      // Always sent as the complete current draft (same "full desired
      // state" contract as purities/sizes/goldColors above), not a delta —
      // this form is the single source of truth for both while it's open,
      // so every Save Product click replaces the saved rules with whatever
      // is currently in these two sections.
      weightRules,
      purityPricingRules,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
      metaKeywords: form.metaKeywords || null,
      ...overrides,
    };
  }

  function addSizeRow() {
    setForm((f) => ({
      ...f,
      sizes: [...(f.sizes ?? []), { label: '', stockQuantity: 0, weightGrams: null, diamondWeightCarats: null }],
    }));
  }

  function updateSizeRow(
    index: number,
    patch: Partial<{ label: string; stockQuantity: number; weightGrams: number | null; diamondWeightCarats: number | null }>,
  ) {
    setForm((f) => ({
      ...f,
      sizes: (f.sizes ?? []).map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  // A purity/size the currently-loaded (saved) product already offers may
  // have real weight rules, purity pricing rules, and stocked variants
  // attached — removing it here deletes all of that once Save Product is
  // clicked. A purity/size that was only just added in this unsaved session
  // (not in the originally-loaded product) has nothing saved to lose, so it
  // comes off immediately with no prompt.
  const originalPurities = productData?.product.purityOptions ?? [];
  const originalSizeLabels = (productData?.product.sizes ?? []).map((s) => s.label);

  function applyRemovePurity(purity: Purity) {
    setForm((f) => ({ ...f, purities: (f.purities ?? []).filter((p) => p !== purity) }));
    setWeightRules((wr) => ({
      purityRules: wr.purityRules.filter((r) => r.purity !== purity),
      puritySizeRules: wr.puritySizeRules.filter((r) => r.purity !== purity),
    }));
    setPurityPricingRules((rules) => rules.filter((r) => r.purity !== purity));
  }

  function applyRemoveSizeRow(index: number) {
    const label = (form.sizes ?? [])[index]?.label.trim();
    setForm((f) => ({ ...f, sizes: (f.sizes ?? []).filter((_, i) => i !== index) }));
    if (label) {
      setWeightRules((wr) => ({ ...wr, puritySizeRules: wr.puritySizeRules.filter((r) => r.sizeLabel !== label) }));
    }
  }

  function removeSizeRow(index: number) {
    const label = (form.sizes ?? [])[index]?.label.trim();
    if (isEditing && label && originalSizeLabels.includes(label)) {
      setPendingRemoval({ type: 'size', index, label });
      return;
    }
    applyRemoveSizeRow(index);
  }

  function toggleGoldColor(color: GoldColor) {
    setForm((f) => ({
      ...f,
      goldColors: (f.goldColors ?? []).includes(color)
        ? (f.goldColors ?? []).filter((c) => c !== color)
        : [...(f.goldColors ?? []), color],
    }));
  }

  function togglePurityOption(purity: Purity) {
    const isSelected = (form.purities ?? []).includes(purity);
    if (isSelected) {
      if (isEditing && originalPurities.includes(purity)) {
        setPendingRemoval({ type: 'purity', value: purity });
        return;
      }
      applyRemovePurity(purity);
      return;
    }
    setForm((f) => ({ ...f, purities: [...(f.purities ?? []), purity] }));
  }

  function toggleDiamondOption(id: string) {
    setForm((f) => ({
      ...f,
      diamondConfigIds: (f.diamondConfigIds ?? []).includes(id)
        ? (f.diamondConfigIds ?? []).filter((c) => c !== id)
        : [...(f.diamondConfigIds ?? []), id],
    }));
  }

  // Keeps the flat form.makingCharge the API actually stores/uses in sync
  // with the % the admin enters, recomputed off the live gold value exactly
  // like the auto-preview effect below keeps goldValue itself current.
  useEffect(() => {
    const computed = Math.round(((form.goldValue ?? 0) * (makingChargePercent || 0)) / 100 * 100) / 100;
    setForm((f) => (f.makingCharge === computed ? f : { ...f, makingCharge: computed }));
  }, [makingChargePercent, form.goldValue]);

  // Early-create path for "Generate with AI" clicked on an unsaved product
  // (plan §3 correction) — ai_studio_jobs.product_id is NOT NULL, so a real
  // product must exist before the Studio route can create a job. Reuses the
  // same createProduct call the normal Save uses. SKU is auto-filled (it's
  // just an internal reference, DB-required but not something the admin
  // needs to think about yet) — name is NOT auto-filled: skipping that check
  // let a bare click create a throwaway "Untitled Product" row with every
  // press, cluttering the Products list even when nobody follows through
  // with an actual upload.
  const createForStudioMutation = useMutation({
    mutationFn: (overrides: { name: string; sku: string }) => createProduct(buildPayload(overrides)),
    // replace: true — the blank Add Product page this came from is stale the
    // instant the product is created (it now exists for real elsewhere), so
    // the browser Back button shouldn't be able to land the admin back on
    // it looking like their just-entered details vanished.
    onSuccess: (result) => navigate(`/products/${result.product.id}/ai-image-studio`, { replace: true }),
    onError: (err) => setImageSourceError(describeError(err, 'Could not create product.')),
  });

  function handleGenerateWithAI() {
    if (isEditing) {
      navigate(`/products/${id}/ai-image-studio`);
      return;
    }
    if (!form.name.trim()) {
      setImageSourceError('Enter a product name before generating images with AI.');
      return;
    }
    setImageSourceError(null);
    const name = form.name.trim();
    const sku = form.sku.trim() || `DRAFT-${Date.now()}`;
    setForm((f) => ({ ...f, name, sku }));
    createForStudioMutation.mutate({ name, sku });
  }

  // Manual Upload had no wired-up action at all in Add mode — the actual
  // upload widget (ProductGallery, below) is edit-only for the same reason
  // AI generation needed an early-create: there's no product row yet to
  // attach images to. Mirrors handleGenerateWithAI's create flow, just
  // landing back on the edit page instead of AI Image Studio.
  const createForManualUploadMutation = useMutation({
    mutationFn: (overrides: { name: string; sku: string }) => createProduct(buildPayload(overrides)),
    // Same reasoning as the AI-studio create path above.
    onSuccess: (result) => navigate(`/products/${result.product.id}/edit`, { replace: true }),
    onError: (err) => setImageSourceError(describeError(err, 'Could not create product.')),
  });

  function handleManualUpload() {
    if (isEditing) return;
    if (!form.name.trim()) {
      setImageSourceError('Enter a product name before uploading images.');
      return;
    }
    setImageSourceError(null);
    const name = form.name.trim();
    const sku = form.sku.trim() || `DRAFT-${Date.now()}`;
    setForm((f) => ({ ...f, name, sku }));
    createForManualUploadMutation.mutate({ name, sku });
  }

  // `wasEditing` is captured at the moment Save is clicked (passed through
  // as the mutate variable, not re-read from the `isEditing` closure) so
  // onSuccess knows unambiguously whether this was a create or an update —
  // a create's own onSuccess is what flips the URL (and therefore
  // `isEditing`) to the new product's edit route, so reading `isEditing`
  // directly inside onSuccess would already reflect the POST-navigation
  // state for a create.
  const saveMutation = useMutation({
    mutationFn: async (wasEditing: boolean) => {
      const payload = buildPayload();
      return wasEditing ? updateProduct(id as string, payload) : createProduct(payload);
    },
    onSuccess: (result, wasEditing) => {
      setError(null);
      if (!wasEditing) {
        queryClient.setQueryData(['admin-product', result.product.id], result);
      } else {
        queryClient.setQueryData(['admin-product', id], result);
      }
      navigate('/products', {
        state: { flashMessage: wasEditing ? 'Product updated successfully' : 'Product created successfully' },
      });
    },
    onError: (err) => {
      setSuccessMessage(null);
      setError(describeError(err, 'Could not save product.'));
      // Field-level errors are almost always about a rule this admin just
      // typed into Weight Defaults/Purity Pricing Rules (a purity/size not
      // actually selected, a percent out of range, a duplicate) — jump
      // there directly instead of leaving the admin to scroll and guess.
      const fields = err instanceof ApiError ? (err.fields ?? []) : [];
      const isVariationError = fields.some(
        (f) => f.path.includes('weightRules') || f.path.includes('purityPricingRules') || f.path.includes('purities') || f.path.includes('sizes'),
      );
      requestAnimationFrame(() => {
        (isVariationError ? variationsSectionRef.current : errorRef.current)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    },
  });

  const priceLockMutation = useMutation({
    mutationFn: (locked: boolean) => setPriceLock(id as string, locked),
  });

  async function runPreview() {
    setIsPreviewing(true);
    try {
      const result = await previewPricing({
        metalType: form.metalType,
        purity: form.purity,
        goldWeightGrams: form.goldWeightGrams,
        diamondWeightCarats: form.diamondWeightCarats,
        diamondConfigId: form.diamondConfigId,
        makingCharge: form.makingCharge,
        gstPercent: form.gstPercent ?? 3,
      });
      setPreview(result);
      setPricingError(null);
      // Auto-apply the computed breakdown so a saved product's Price
      // Breakup is correct immediately — sellingPrice stays admin-set
      // ("Use this price" below applies it explicitly).
      setForm((f) => ({ ...f, goldValue: result.goldValue, diamondValue: result.diamondValue }));
      return true;
    } catch (err) {
      setPreview(null);
      setPricingError(err instanceof ApiError ? err.message : 'Could not preview pricing.');
      return false;
    } finally {
      setIsPreviewing(false);
    }
  }

  // Debounced auto-preview whenever the inputs that feed pricing change —
  // only once there's something meaningful to compute (a purity for GOLD,
  // or a diamond weight), so an empty new-product form doesn't error. Skips
  // price-locked products entirely — opening the edit form shouldn't
  // silently recompute a value the admin deliberately froze.
  useEffect(() => {
    if (productData?.product.isPriceLocked) return;
    const hasGoldInputs = form.metalType === 'GOLD' && !!form.purity && !!form.goldWeightGrams;
    const hasDiamondInputs = !!form.diamondWeightCarats && !!form.diamondConfigId;
    if (!hasGoldInputs && !hasDiamondInputs) return;

    const timer = setTimeout(() => {
      runPreview();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.metalType,
    form.purity,
    form.goldWeightGrams,
    form.diamondWeightCarats,
    form.diamondConfigId,
    form.makingCharge,
    form.gstPercent,
  ]);

  function applyPreview() {
    if (!preview) return;
    setForm((f) => ({
      ...f,
      goldValue: preview.goldValue,
      diamondValue: preview.diamondValue,
      sellingPrice: preview.sellingPrice,
    }));
  }

  if (isEditing && isProductLoading) return <p>Loading…</p>;

  const categories = categoriesData?.categories ?? [];
  const collections = collectionsData?.collections ?? [];
  const isPriceLocked = productData?.product.isPriceLocked ?? false;
  // Mirrors the cartesian product syncProductVariants generates server-side
  // — a pure client-side count for the "N combinations selected" summary,
  // not a price/stock calculation.
  const variationAxisSizes = [
    (form.goldColors ?? []).length,
    (form.purities ?? []).length,
    (form.diamondConfigIds ?? []).length,
    (form.sizes ?? []).filter((s) => s.label.trim().length > 0).length,
  ].filter((n) => n > 0);
  const variationComboCount = variationAxisSizes.length === 0 ? 0 : variationAxisSizes.reduce((a, n) => a * n, 1);

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>{isEditing ? 'Edit Product' : 'Add Product'}</h1>
        {/* Top Save Product button, for long desktop forms — `form`
            attribute submits the same <form> below via the native HTML
            association, so this is never a second save path, just a second
            place to trigger the identical submit handler. */}
        <button
          type="submit"
          form="product-form"
          className={sharedStyles.buttonPrimary}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving Product…' : 'Save Product'}
        </button>
      </div>

      {successMessage && <p className={sharedStyles.success}>{successMessage}</p>}

      <form
        id="product-form"
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          // Guards against a double-fire (e.g. Enter pressed while the
          // first submit's request is still in flight) — both Save Product
          // buttons are already `disabled` while pending, but the submit
          // event itself is a second line of defense.
          if (saveMutation.isPending) return;
          setError(null);
          setSuccessMessage(null);
          // Only name and at least one image are required to save — every
          // other field (SKU, pricing, sizes, variations, SEO...) is
          // optional and can be filled in later.
          if (!form.name.trim()) {
            setError('Enter a product name.');
            requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
            return;
          }
          if (isEditing && (imagesData?.images.length ?? 0) === 0) {
            setError('Add at least one product image before saving — use Manual Upload or Generate with AI above.');
            requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
            return;
          }
          saveMutation.mutate(isEditing);
        }}
      >
        <section className={sharedStyles.cardPadded}>
          <h2 className={styles.sectionHeading}>Basic Info</h2>
          <div className={sharedStyles.formGrid}>
            <label className={sharedStyles.field}>
              Name
              <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </label>
            <label className={sharedStyles.field}>
              SKU (optional — auto-generated if left blank)
              <input value={form.sku} onChange={(e) => set('sku', e.target.value)} />
            </label>
            <label className={sharedStyles.field}>
              Status
              <select value={form.status} onChange={(e) => set('status', e.target.value as ProductStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className={sharedStyles.field}>
              Category
              <select
                value={form.categoryId ?? ''}
                onChange={(e) => set('categoryId', e.target.value || null)}
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={sharedStyles.field}>
              Collection
              <select
                value={form.collectionId ?? ''}
                onChange={(e) => set('collectionId', e.target.value || null)}
              >
                <option value="">— None —</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={`${sharedStyles.field} ${sharedStyles.formSection}`}>
            Short Description
            <textarea
              value={form.shortDescription ?? ''}
              onChange={(e) => set('shortDescription', e.target.value)}
              rows={2}
            />
          </label>
          <label className={`${sharedStyles.field} ${sharedStyles.formSection}`}>
            Full Description
            <textarea
              value={form.fullDescription ?? ''}
              onChange={(e) => set('fullDescription', e.target.value)}
              rows={4}
            />
          </label>
          <label className={`${sharedStyles.field} ${sharedStyles.checkboxField} ${sharedStyles.formSection}`}>
            <input
              type="checkbox"
              checked={form.showDeliveryChecker ?? true}
              onChange={(e) => set('showDeliveryChecker', e.target.checked)}
            />
            Show "Check Delivery &amp; Availability" pincode widget on the product page
          </label>
          <label className={`${sharedStyles.field} ${sharedStyles.checkboxField}`}>
            <input
              type="checkbox"
              checked={form.isNonReturnable ?? false}
              onChange={(e) => set('isNonReturnable', e.target.checked)}
            />
            Non-returnable — no change-of-mind returns (solitaire, custom, engraved). Returns still allowed if damaged,
            defective or wrong. Also applies automatically if its category is marked non-returnable.
          </label>
        </section>

        <section className={sharedStyles.cardPadded}>
          <h2 className={styles.sectionHeading}>Product Images</h2>
          {imageSourceError && <p className={sharedStyles.error}>{imageSourceError}</p>}
          {pendingReviewJob && (
            <p className={styles.sectionWarning}>
              {pendingReviewJob.pendingCount} AI-generated image{pendingReviewJob.pendingCount === 1 ? '' : 's'} from a
              previous generation {pendingReviewJob.pendingCount === 1 ? "wasn't" : "weren't"} imported
              {pendingReviewJob.needsReview ? ' — flagged by validation and never accepted' : ''}, so it
              {pendingReviewJob.pendingCount === 1 ? "'s" : "'re"} not showing on the storefront.{' '}
              <Link to={`/products/${id}/ai-image-studio?jobId=${pendingReviewJob.id}`}>Review now</Link>
            </p>
          )}
          <div className={styles.imageSourceGrid}>
            <div className={styles.imageSourceCard}>
              <p className={styles.imageSourceTitle}>Manual Upload</p>
              {isEditing ? (
                <ProductGallery productId={id as string} />
              ) : (
                <>
                  <p className={styles.imageSourceBody}>Upload your own featured and gallery images.</p>
                  <button
                    type="button"
                    className={sharedStyles.button}
                    disabled={createForManualUploadMutation.isPending}
                    onClick={handleManualUpload}
                  >
                    {createForManualUploadMutation.isPending ? 'Creating…' : 'Start Manual Upload'}
                  </button>
                </>
              )}
            </div>
            <div className={styles.imageSourceCardRecommended}>
              <span className={sharedStyles.badgeSuccess}>Recommended</span>
              <p className={styles.imageSourceTitle}>Generate with AI</p>
              <p className={styles.imageSourceBody}>
                Upload jewellery references and generate a front, 45° hero, presenter, and lifestyle image.
              </p>
              <button
                type="button"
                className={sharedStyles.buttonPrimary}
                disabled={createForStudioMutation.isPending}
                onClick={handleGenerateWithAI}
              >
                {createForStudioMutation.isPending ? 'Creating…' : 'Start AI Generation'}
              </button>
            </div>
          </div>
        </section>

        {isEditing && (
          <ProductSizeImagePanel
            productId={id as string}
            categoryName={categories.find((c) => c.id === form.categoryId)?.name ?? null}
          />
        )}

        <section className={sharedStyles.cardPadded}>
          <h2 className={styles.sectionHeading}>Metal, Diamond &amp; Pricing</h2>
          <div className={sharedStyles.formGrid}>
            <label className={sharedStyles.field}>
              Metal Type
              <select value={form.metalType} onChange={(e) => set('metalType', e.target.value as MetalType)}>
                {METAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className={sharedStyles.field}>
              Purity {form.metalType === 'PLATINUM' && '(N/A for platinum)'}
              <select
                value={form.purity ?? ''}
                onChange={(e) => set('purity', (e.target.value || null) as Purity | null)}
                disabled={form.metalType === 'PLATINUM'}
              >
                <option value="">—</option>
                {PURITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className={sharedStyles.field}>
              Gold Color {form.metalType === 'PLATINUM' && '(N/A for platinum)'}
              <select
                value={form.goldColor ?? ''}
                onChange={(e) => set('goldColor', (e.target.value || null) as GoldColor | null)}
                disabled={form.metalType === 'PLATINUM'}
              >
                <option value="">—</option>
                {GOLD_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={sharedStyles.field}>
              Gold Weight (g)
              <input
                type="number"
                step="0.001"
                value={form.goldWeightGrams ?? ''}
                onChange={(e) => set('goldWeightGrams', e.target.value ? Number(e.target.value) : null)}
              />
            </label>
            <label className={sharedStyles.field}>
              Diamond Weight (g)
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="Added into Gross Weight"
                value={form.diamondWeightGrams ?? ''}
                onChange={(e) => set('diamondWeightGrams', e.target.value ? Number(e.target.value) : null)}
              />
              <span className={styles.sectionHint}>
                Gross Weight ≈ {(Number(form.goldWeightGrams ?? 0) + Number(form.diamondWeightGrams ?? 0)).toFixed(3)} g
                {' '}(Net Weight = Gold Weight only)
              </span>
            </label>
            <label className={sharedStyles.field}>
              Diamond Quality
              <select
                value={form.diamondConfigId ?? ''}
                onChange={(e) => set('diamondConfigId', e.target.value || null)}
              >
                <option value="">—</option>
                {(diamondConfigsData?.diamondConfigs ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (₹{c.ratePerCent.toLocaleString('en-IN')}/cent)
                  </option>
                ))}
              </select>
            </label>
            <label className={sharedStyles.field}>
              Diamond Carat (in cents) {form.diamondWeightCarats ? `— ${form.diamondWeightCarats} ct` : ''}
              <input
                type="number"
                step="0.1"
                // Entered/displayed in cents (1 carat = 100 cents) — stored as
                // carats under the hood so the pricing engine (rate-per-carat)
                // and everything downstream is untouched.
                value={form.diamondWeightCarats ? Math.round(form.diamondWeightCarats * 1000) / 10 : ''}
                onChange={(e) =>
                  set('diamondWeightCarats', e.target.value ? Number(e.target.value) / 100 : null)
                }
              />
            </label>
            <label className={sharedStyles.field}>
              Diamond Count
              <input
                type="number"
                value={form.diamondCount ?? ''}
                onChange={(e) => set('diamondCount', e.target.value ? Number(e.target.value) : null)}
              />
            </label>
            <label className={sharedStyles.field}>
              Certification
              <input value={form.certification ?? ''} onChange={(e) => set('certification', e.target.value)} />
            </label>
          </div>

          <div className={`${sharedStyles.formGrid} ${sharedStyles.formSection}`}>
            <label className={sharedStyles.field}>
              Default Making Charge (%)
              <input
                type="number"
                step="0.01"
                value={makingChargePercent}
                onChange={(e) => setMakingChargePercent(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <span className={styles.sectionHint}>≈ {formatPrice(form.makingCharge ?? 0)}</span>
            </label>
            <label className={sharedStyles.field}>
              GST %
              <input
                type="number"
                step="0.01"
                value={form.gstPercent ?? ''}
                onChange={(e) => set('gstPercent', e.target.value ? Number(e.target.value) : undefined)}
              />
            </label>
          </div>

          <div className={`${sharedStyles.formGrid} ${sharedStyles.formSection}`}>
            <label className={sharedStyles.field}>
              Default Making Charge Discount (%)
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
                value={form.makingChargeDiscountPercent ?? ''}
                onChange={(e) =>
                  set('makingChargeDiscountPercent', e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </label>
            <label className={sharedStyles.field}>
              Default Diamond Discount (%)
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
                value={form.diamondDiscountPercent ?? ''}
                onChange={(e) => set('diamondDiscountPercent', e.target.value ? Number(e.target.value) : undefined)}
              />
            </label>
            <span className={styles.sectionHint}>
              Leave blank/0 for no offer. When set, this recalculates and lowers the Selling Price shown to
              shoppers — it's a real discount, not just a label. These default values are used when a
              purity-specific value is not configured below.
            </span>
          </div>

          <div className={styles.previewBox}>
            <button type="button" className={sharedStyles.button} onClick={runPreview} disabled={isPreviewing}>
              {isPreviewing ? 'Calculating…' : 'Preview Live Price'}
            </button>
            {pricingError && <p className={sharedStyles.error}>{pricingError}</p>}
            {preview && (
              <div className={styles.previewResult}>
                <span>Gold/Metal: {formatPrice(preview.goldValue)}</span>
                <span>Diamond: {formatPrice(preview.diamondValue)}</span>
                <span className={styles.previewTotal}>Suggested Selling Price: {formatPrice(preview.sellingPrice)}</span>
                <button type="button" className={sharedStyles.buttonLink} onClick={applyPreview}>
                  Use this price
                </button>
              </div>
            )}
          </div>

          <label className={`${sharedStyles.field} ${sharedStyles.formSection}`}>
            Selling Price (₹) — final, admin-overridable
            <input
              type="number"
              value={form.sellingPrice ?? 0}
              onChange={(e) => set('sellingPrice', Number(e.target.value))}
            />
          </label>

          {isEditing && (
            <label className={`${sharedStyles.field} ${sharedStyles.checkboxField} ${sharedStyles.formSection}`}>
              <input
                type="checkbox"
                checked={isPriceLocked}
                onChange={(e) => priceLockMutation.mutate(e.target.checked)}
              />
              Lock price (exclude from automatic gold-rate recalculation)
            </label>
          )}
        </section>

        <section ref={variationsSectionRef} className={`${sharedStyles.cardPadded} ${pv.section}`}>
          <div className={pv.headRow}>
            <h2 className={pv.heading}>Product Variations</h2>
            <p className={pv.sub}>
              Choose what customers can select. Defaults apply to every combination unless you add an
              exception.
            </p>
          </div>

          <div className={pv.modeGrid}>
            <button
              type="button"
              className={variationMode === 'fixed' ? pv.modeCardSelected : pv.modeCard}
              onClick={() => {
                if (hasAnyAxis(form)) setPendingFixedSwitch(true);
                else setVariationMode('fixed');
              }}
            >
              <span className={pv.modeTitle}>
                <span className={pv.modeRadioDot} />
                Fixed Product
              </span>
              <span className={pv.modeDesc}>One configuration only</span>
            </button>
            <button
              type="button"
              className={variationMode === 'selectable' ? pv.modeCardSelected : pv.modeCard}
              onClick={() => setVariationMode('selectable')}
            >
              <span className={pv.modeTitle}>
                <span className={pv.modeRadioDot} />
                Selectable Options
              </span>
              <span className={pv.modeDesc}>Customers choose colour, purity, quality or size</span>
            </button>
          </div>

          {variationMode === 'selectable' && (
            <>
              <div className={pv.optionsBlock}>
                <OptionChipRow
                  label="Gold Colour"
                  options={GOLD_COLORS.map((c) => ({
                    key: c.value,
                    label: c.label,
                    selected: (form.goldColors ?? []).includes(c.value),
                  }))}
                  onToggle={(key) => toggleGoldColor(key as GoldColor)}
                />

                <OptionChipRow
                  label="Purity"
                  options={PURITIES.map((p) => ({
                    key: p,
                    label: p,
                    selected: (form.purities ?? []).includes(p),
                  }))}
                  onToggle={(key) => togglePurityOption(key as Purity)}
                />

                <OptionChipRow
                  label="Diamond Quality"
                  options={(diamondConfigsData?.diamondConfigs ?? []).map((c) => ({
                    key: c.id,
                    label: c.name,
                    selected: (form.diamondConfigIds ?? []).includes(c.id),
                  }))}
                  onToggle={toggleDiamondOption}
                  emptyNote="No diamond quality tiers exist yet — add one on the Pricing page."
                />

                <div className={pv.attrRow}>
                  <div className={pv.attrLabelRow}>
                    <span className={pv.attrLabel}>Size</span>
                    <label className={pv.sizeLabelOverride}>
                      Field label on storefront
                      <input
                        value={form.sizeLabel ?? ''}
                        placeholder="Size"
                        onChange={(e) => set('sizeLabel', e.target.value)}
                      />
                    </label>
                  </div>
                  {(form.sizes ?? []).length === 0 ? (
                    <p className={pv.emptyNote}>No sizes added — this product doesn't need a size choice.</p>
                  ) : (
                    <div className={pv.sizeTableWrap}>
                      <table className={pv.sizeTable}>
                        <thead>
                          <tr>
                            <th>Size</th>
                            <th>Stock</th>
                            <th>Gold Weight (g)</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(form.sizes ?? []).map((size, i) => (
                            <tr key={i}>
                              <td>
                                <input
                                  value={size.label}
                                  placeholder="e.g. 6"
                                  onChange={(e) => updateSizeRow(i, { label: e.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  value={size.stockQuantity === 0 ? '' : size.stockQuantity}
                                  onChange={(e) =>
                                    updateSizeRow(i, {
                                      stockQuantity: e.target.value === '' ? 0 : Number(e.target.value),
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  placeholder="inherit"
                                  value={size.weightGrams ?? ''}
                                  onChange={(e) =>
                                    updateSizeRow(i, { weightGrams: e.target.value ? Number(e.target.value) : null })
                                  }
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className={pv.sizeRemoveBtn}
                                  onClick={() => removeSizeRow(i)}
                                  aria-label={`Remove size ${size.label || i + 1}`}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div>
                    <button type="button" className={pv.chipAdd} onClick={addSizeRow}>
                      + Add Size
                    </button>
                  </div>
                </div>
              </div>

              <div className={pv.summaryBar}>
                <span className={pv.summaryCount}>
                  {variationComboCount} combination{variationComboCount === 1 ? '' : 's'} selected
                </span>
                <span className={pv.summaryMeta}>{variationComboCount} available</span>
              </div>

              <div className={pv.defaultsRow}>
                <div className={pv.defaultsItem}>
                  <span className={pv.defaultsLabel}>Base Gold Weight</span>
                  <span className={pv.defaultsValue}>
                    {form.goldWeightGrams != null ? `${form.goldWeightGrams}g` : '— set below in Pricing'}
                  </span>
                </div>
                <div className={pv.defaultsItem}>
                  <span className={pv.defaultsLabel}>Default Stock</span>
                  <input
                    type="number"
                    min="0"
                    className={pv.defaultsInput}
                    value={form.stockQuantity === 0 ? '' : (form.stockQuantity ?? '')}
                    placeholder="0"
                    onChange={(e) => set('stockQuantity', e.target.value === '' ? 0 : Number(e.target.value))}
                  />
                </div>
                <div className={pv.defaultsItem}>
                  <span className={pv.defaultsLabel}>Availability</span>
                  <span className={pv.pill}>Active</span>
                </div>
                <div className={pv.defaultsItem}>
                  <span className={pv.defaultsLabel}>Pricing</span>
                  <span className={pv.defaultsValue}>Automatically calculated</span>
                </div>
              </div>
              <p className={pv.note}>New combinations inherit these values.</p>

              {/* Driven entirely by the form's own unsaved purities/sizes —
                  no productId, no saved-attributes wait. Appears the
                  instant a purity is picked, in both Add and Edit mode, and
                  is submitted through the single Save Product action below
                  rather than owning its own save/API call. */}
              <WeightDefaults
                purities={form.purities ?? []}
                sizes={form.sizes ?? []}
                value={weightRules}
                onChange={setWeightRules}
              />

              <PurityPricingRules
                purities={form.purities ?? []}
                productDefaults={{
                  makingChargePercent: makingChargePercent === '' ? null : makingChargePercent,
                  makingChargeDiscountPercent: form.makingChargeDiscountPercent ?? 0,
                  diamondDiscountPercent: form.diamondDiscountPercent ?? 0,
                }}
                value={purityPricingRules}
                onChange={setPurityPricingRules}
              />

              {isEditing && id && productData?.product.attributes && (
                <AvailabilityRules productId={id} attributes={productData.product.attributes} />
              )}

              {preview && (
                <div className={pv.pricePreview}>
                  <div className={pv.pricePreviewHead}>
                    <span className={pv.pricePreviewTitle}>Price Preview</span>
                    <button type="button" className={pv.refreshBtn} onClick={runPreview} disabled={isPreviewing}>
                      {isPreviewing ? 'Calculating…' : 'Refresh'}
                    </button>
                  </div>
                  <div className={pv.priceRows}>
                    <div className={pv.priceRow}>
                      <span>Gold value</span>
                      <span>{formatPrice(preview.goldValue)}</span>
                    </div>
                    <div className={pv.priceRow}>
                      <span>Diamond value</span>
                      <span>{formatPrice(preview.diamondValue)}</span>
                    </div>
                    <div className={pv.priceRow}>
                      <span>Making charge</span>
                      <span>{formatPrice(preview.makingCharge)}</span>
                    </div>
                    <div className={pv.priceRow}>
                      <span>GST</span>
                      <span>
                        {formatPrice(
                          Math.max(0, preview.sellingPrice - preview.goldValue - preview.diamondValue - preview.makingCharge),
                        )}
                      </span>
                    </div>
                    <div className={pv.priceRowTotal}>
                      <span>Estimated selling price</span>
                      <span>{formatPrice(preview.sellingPrice)}</span>
                    </div>
                  </div>
                  <p className={pv.estimateTag}>Estimate, based on today's gold rate — recalculated per variant on save.</p>
                </div>
              )}

              {isEditing && id ? (
                <AdvancedVariantSummary productId={id} />
              ) : (
                variationComboCount > 0 && (
                  <div className={pv.advancedPanel}>
                    <div className={pv.advancedHead}>
                      <div className={pv.advancedTitleRow}>
                        <span className={pv.advancedTitle}>Advanced Variant Management</span>
                        <span className={pv.badge}>{variationComboCount} combinations</span>
                      </div>
                      <button
                        type="button"
                        className={pv.chevronBtn}
                        onClick={() => setMatrixExpanded((v) => !v)}
                        aria-expanded={matrixExpanded}
                      >
                        {matrixExpanded ? '▲ Hide' : '▼ Manage Exceptions'}
                      </button>
                    </div>
                    <p className={pv.advancedSub}>
                      Edit an exact combination's stock, weight or availability only when it differs from the
                      defaults above.
                    </p>
                    {matrixExpanded && (
                      <div className={pv.advancedBody}>
                        <VariantMatrixEditor
                          goldColors={form.goldColors ?? []}
                          purities={form.purities ?? []}
                          diamondConfigIds={form.diamondConfigIds ?? []}
                          goldColorLabels={GOLD_COLOR_LABELS}
                          diamondConfigNames={diamondConfigNames}
                          sizeLabels={(form.sizes ?? []).map((s) => s.label.trim()).filter(Boolean)}
                          value={variantOverrides}
                          onChange={setVariantOverrides}
                        />
                      </div>
                    )}
                  </div>
                )
              )}
            </>
          )}
        </section>

        {pendingFixedSwitch && (
          <ConfirmDialog
            title="Switch to Fixed Product?"
            message="This removes all Gold Colour, Purity, Diamond Quality and Size options from this product. Existing per-combination stock and weight data for those options will be cleared once you save — this can't be undone from here."
            confirmLabel="Switch to Fixed"
            cancelLabel="Keep Selectable Options"
            danger
            onConfirm={confirmSwitchToFixed}
            onCancel={() => setPendingFixedSwitch(false)}
          />
        )}

        {pendingRemoval && (
          <ConfirmDialog
            title={pendingRemoval.type === 'purity' ? `Remove ${pendingRemoval.value}?` : `Remove size ${pendingRemoval.label}?`}
            message="This has saved weight and/or purity pricing rules and variants attached. Removing it here deletes that saved data once you click Save Product — this can't be undone from here."
            confirmLabel="Remove"
            cancelLabel="Keep"
            danger
            onConfirm={() => {
              if (pendingRemoval.type === 'purity') applyRemovePurity(pendingRemoval.value);
              else applyRemoveSizeRow(pendingRemoval.index);
              setPendingRemoval(null);
            }}
            onCancel={() => setPendingRemoval(null)}
          />
        )}

        <section className={sharedStyles.cardPadded}>
          <h2 className={styles.sectionHeading}>SEO</h2>
          <label className={sharedStyles.field}>
            Meta Title
            <input value={form.metaTitle ?? ''} onChange={(e) => set('metaTitle', e.target.value)} />
          </label>
          <label className={`${sharedStyles.field} ${sharedStyles.formSection}`}>
            Meta Description
            <textarea value={form.metaDescription ?? ''} onChange={(e) => set('metaDescription', e.target.value)} rows={2} />
          </label>
          <label className={`${sharedStyles.field} ${sharedStyles.formSection}`}>
            Meta Keywords
            <input value={form.metaKeywords ?? ''} onChange={(e) => set('metaKeywords', e.target.value)} />
          </label>
        </section>

        {error && (
          <p ref={errorRef} className={sharedStyles.error}>
            {error}
          </p>
        )}

        <div className={sharedStyles.formActions}>
          <button type="submit" className={sharedStyles.buttonPrimary} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving Product…' : 'Save Product'}
          </button>
          <button type="button" className={sharedStyles.button} onClick={() => navigate('/products')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
