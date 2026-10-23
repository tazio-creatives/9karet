import { apiFetch, ApiError } from './client';
import type { GoldColor } from './types';

export type JewelleryType =
  | 'RING'
  | 'BRACELET'
  | 'BANGLE'
  | 'NECKLACE'
  | 'EARRINGS'
  | 'PENDANT'
  | 'CHAIN'
  | 'ANKLET'
  | 'NOSE_PIN'
  | 'MANGALSUTRA'
  | 'BROOCH'
  | 'OTHER'
  | 'UNKNOWN';

export const REAL_JEWELLERY_TYPES: Exclude<JewelleryType, 'UNKNOWN'>[] = [
  'RING',
  'BRACELET',
  'BANGLE',
  'NECKLACE',
  'EARRINGS',
  'PENDANT',
  'CHAIN',
  'ANKLET',
  'NOSE_PIN',
  'MANGALSUTRA',
  'BROOCH',
  'OTHER',
];

// WHO the piece is designed for — a separate dimension from JewelleryType
// (WHAT the piece is). Drives presenter selection only (Gents -> adult male
// presenter, Kids -> child model ~2-4). 'WOMEN' is the default and matches
// today's only presenter styling.
export type CustomerCategory = 'WOMEN' | 'GENTS' | 'KIDS' | 'UNISEX';
export const CUSTOMER_CATEGORIES: CustomerCategory[] = ['WOMEN', 'GENTS', 'KIDS', 'UNISEX'];

// Metal color is now encoded directly in the asset type (e.g. ROSE_FRONT)
// instead of being a separate per-job field — a job can produce both Yellow
// and Rose Gold shots side by side.
//
// The 6 RING_* types are a completely separate, Ring-only output structure
// (2 hand-model shots + Front/Side catalogue shots, no 45° Hero) — see
// generationRules.ts's resolveAssetTypesForJob for where jobs branch onto
// this set instead of the generic YELLOW_*/ROSE_*/PRESENTER_* one above.
export type AssetType =
  | 'YELLOW_FRONT'
  | 'YELLOW_HERO_45'
  | 'ROSE_FRONT'
  | 'ROSE_HERO_45'
  | 'PRESENTER_YELLOW_1'
  | 'PRESENTER_YELLOW_2'
  | 'PRESENTER_ROSE'
  | 'RING_HAND_1'
  | 'RING_HAND_2'
  | 'RING_GOLD_FRONT'
  | 'RING_GOLD_SIDE'
  | 'RING_ROSE_FRONT'
  | 'RING_ROSE_SIDE';

export type AssetStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';
export type StudioJobStatus =
  | 'draft'
  | 'uploading'
  | 'analysing'
  | 'awaiting_confirmation'
  | 'generating'
  | 'review_ready'
  | 'importing'
  | 'completed'
  | 'failed'
  | 'partially_failed'
  | 'cancelled';

export interface StudioAnalysis {
  jewelleryType: JewelleryType;
  jewelleryTypeConfidence: number;
  metalColor: GoldColor | null;
  metalColorConfidence: number;
  gemstone: string | null;
  gemstoneConfidence: number;
  dominantShape: string | null;
  shapeConfidence: number;
  suggestedCategorySlug: string | null;
  customerCategory: CustomerCategory;
  customerCategoryConfidence: number;
}

// The only fields a "Customise Prompt" admin can edit on the Review Prompts
// panel — everything else stays locked/computed. Mirrors the backend's
// creativeOverrideSchema exactly.
export interface PromptCreativeOverride {
  background?: string;
  lighting?: string;
  composition?: string;
  presenterPose?: string;
  cameraAngle?: string;
  additionalInstructions?: string;
}

export type PromptOverrides = Record<string, PromptCreativeOverride>;

export interface PromptPreview {
  assetType: AssetType;
  metalColor: 'YELLOW' | 'ROSE';
  mode: 'recommended' | 'customised';
  lockedProductRules: string[];
  categoryPlacementRules: string[];
  creativeInstructions: {
    background: string;
    lighting: string;
    composition: string;
    presenterPose: string;
    cameraAngle: string;
    additionalInstructions: string;
  };
  negativeInstructions: string[];
  finalPrompt: string;
}

export type ValidationStatus = 'passed' | 'warning' | 'failed';

export interface ValidationResult {
  validationStatus: ValidationStatus;
  detectedJewelleryTypes: JewelleryType[];
  expectedJewelleryType: JewelleryType;
  additionalOrnamentsDetected: string[];
  placementStatus: 'correct' | 'incorrect' | 'partially_obscured' | 'not_applicable';
  metalColourStatus: 'correct' | 'incorrect';
  productSimilarityScore: number;
  validationMessages: string[];
}

export interface StudioAsset {
  id: string;
  assetType: AssetType;
  displayOrder: number;
  status: AssetStatus;
  imageUrl: string | null;
  qualityAssessment: unknown;
  promptMode: 'recommended' | 'customised';
  customCreativeInstructions: PromptCreativeOverride | null;
  assembledFinalPrompt: string | null;
  validationStatus: ValidationStatus | null;
  validationResult: ValidationResult | null;
  validationAccepted: boolean;
  selected: boolean;
  isFeatured: boolean;
  imported: boolean;
  retryCount: number;
  generationStartedAt: string | null;
  generationCompletedAt: string | null;
  error: string | null;
}

export interface StudioJob {
  id: string;
  productId: string;
  status: StudioJobStatus;
  referenceImageUrls: string[];
  analysis: StudioAnalysis | null;
  analysisConfidence: number | null;
  categoryConfidenceThreshold: number;
  existingProductCategory: string | null;
  aiDetectedCategory: JewelleryType | null;
  jewelleryType: JewelleryType | null;
  categoryId: string | null;
  customerCategory: CustomerCategory;
  aiDetectedCustomerCategory: CustomerCategory | null;
  customerCategoryConfirmedAt: string | null;
  presenterId: string | null;
  presenter: { id: string; displayName: string; styleLabel: string } | null;
  generateRoseGold: boolean;
  error: string | null;
  createdAt: string;
  confirmedAt: string | null;
  categoryConfirmedAt: string | null;
  completedAt: string | null;
  generationVersion: number;
  assets: StudioAsset[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

// Multipart upload, same reason every other image endpoint bypasses apiFetch.
// files[0] is always the primary reference image (UploadStep.tsx enforces this).
export async function createStudioJob(productId: string, files: File[]) {
  const formData = new FormData();
  for (const file of files) formData.append('images', file);

  const response = await fetch(`${API_BASE_URL}/admin/products/${productId}/ai-studio`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': '9karet' },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error?.message ?? response.statusText, body.error?.fields);
  }
  return response.json() as Promise<{ jobId: string }>;
}

// Resumes an in-progress job for a product instead of always starting at
// Upload — called once on the Studio page mount.
export function fetchActiveStudioJob(productId: string) {
  return apiFetch<{ jobId: string | null }>(`/admin/products/${productId}/ai-studio/active`);
}

export interface StudioPendingReview {
  id: string;
  status: StudioJobStatus;
  pendingCount: number;
  needsReview: boolean;
}

// Surfaces a finished AI Studio job that still has an unimported image —
// separate from fetchActiveStudioJob, which only ever finds a job that's
// still in progress. Used by the product form's "N AI images not imported"
// banner so this stays discoverable even after the job itself is done.
export function fetchStudioPendingReview(productId: string) {
  return apiFetch<{ job: StudioPendingReview | null }>(
    `/admin/products/${productId}/ai-studio/pending-review`,
  );
}

export function fetchStudioJob(productId: string, jobId: string) {
  return apiFetch<{ job: StudioJob }>(`/admin/products/${productId}/ai-studio/${jobId}`);
}

export function confirmStudioJob(
  productId: string,
  jobId: string,
  input: {
    jewelleryType: Exclude<JewelleryType, 'UNKNOWN'>;
    categoryId: string | null;
    presenterId: string | null;
    generateRoseGold: boolean;
    promptOverrides?: PromptOverrides;
    customerCategory?: CustomerCategory;
  },
) {
  return apiFetch<{ jobId: string }>(`/admin/products/${productId}/ai-studio/${jobId}/confirm`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Computes every planned asset's prompt without starting the job — powers
// the Review Prompts panel, callable repeatedly as the admin adjusts the
// presenter, Rose Gold toggle, or a per-card customisation.
export function fetchPromptPreview(
  productId: string,
  jobId: string,
  input: {
    jewelleryType?: Exclude<JewelleryType, 'UNKNOWN'>;
    presenterId?: string | null;
    generateRoseGold?: boolean;
    promptOverrides?: PromptOverrides;
    customerCategory?: CustomerCategory;
  },
) {
  return apiFetch<{ prompts: PromptPreview[] }>(`/admin/products/${productId}/ai-studio/${jobId}/prompt-preview`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Also used for Step 4/5's "Regenerate" action on a completed (READY) asset,
// not just a genuinely failed one — same endpoint, the backend now allows
// either starting status.
export function retryStudioAsset(productId: string, jobId: string, assetId: string) {
  return apiFetch<{ jobId: string }>(
    `/admin/products/${productId}/ai-studio/${jobId}/assets/${assetId}/retry`,
    { method: 'POST' },
  );
}

// Gents-only — discards the job's stored master presenter identity and
// regenerates both Gents presenter shots together against a fresh one. The
// only action that creates a new presenter identity after the first exists;
// ordinary per-tile "Regenerate" (retryStudioAsset above) always reuses it.
export function changeGentsPresenter(productId: string, jobId: string) {
  return apiFetch<{ jobId: string }>(
    `/admin/products/${productId}/ai-studio/${jobId}/gents-presenter/change`,
    { method: 'POST' },
  );
}

// Step 5's per-card select/deselect, "Set as Featured", "Accept Anyway"
// (validationAccepted), and "Edit Prompt & Regenerate" (customCreativeInstructions
// — recomputes and persists just this asset's prompt, ahead of a retry) actions.
export function updateStudioAssetSelection(
  productId: string,
  jobId: string,
  assetId: string,
  input: {
    selected?: boolean;
    isFeatured?: boolean;
    validationAccepted?: boolean;
    customCreativeInstructions?: PromptCreativeOverride;
  },
) {
  return apiFetch<{ asset: StudioAsset }>(
    `/admin/products/${productId}/ai-studio/${jobId}/assets/${assetId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

// Imports one selected+ready asset — called sequentially over every selected
// asset by the frontend so it can show a real completed/total progress bar.
export function importStudioAsset(productId: string, jobId: string, assetId: string) {
  return apiFetch<{ imported: boolean; alreadyImported: boolean; asset: StudioAsset }>(
    `/admin/products/${productId}/ai-studio/${jobId}/assets/${assetId}/import`,
    { method: 'POST' },
  );
}

// Finalizes the job once every selected asset has been imported.
export function completeStudioImport(productId: string, jobId: string) {
  return apiFetch<{ imported: boolean; alreadyCompleted: boolean }>(
    `/admin/products/${productId}/ai-studio/${jobId}/import/complete`,
    { method: 'POST' },
  );
}

export function cancelStudioJob(productId: string, jobId: string) {
  return apiFetch<void>(`/admin/products/${productId}/ai-studio/${jobId}/cancel`, { method: 'POST' });
}
