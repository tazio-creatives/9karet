import { Router } from 'express';
import {
  adminList,
  adminGet,
  adminCreate,
  adminUpdate,
  adminDelete,
  setFeatured,
  bulkSetCollection,
  setBestSeller,
  listVariants,
  updateVariant,
  bulkUpdateVariants,
  listExclusionRules,
  createExclusionRule,
  deleteExclusionRule,
  getWeightRules,
  replaceWeightRules,
  getPurityPricingRules,
  replacePurityPricingRules,
} from '../../controllers/products.controller.js';
import { setPriceLock } from '../../controllers/pricing.controller.js';
import {
  list as listImages,
  uploadOriginal,
  setPrimary,
  reorder,
  remove as removeImage,
  listAllImages,
  attachExisting,
} from '../../controllers/productImages.controller.js';
import { getStatus, approve, reject, regenerate } from '../../controllers/aiImages.controller.js';
import {
  createJob as createStudioJob,
  getActiveJob as getActiveStudioJob,
  getPendingReview as getStudioPendingReview,
  getJob as getStudioJob,
  confirmJob as confirmStudioJob,
  previewPrompts as previewStudioPrompts,
  retryAsset as retryStudioAsset,
  changeGentsPresenter,
  updateAssetSelection as updateStudioAssetSelection,
  importAsset as importStudioAsset,
  completeImport as completeStudioImport,
  cancelJob as cancelStudioJob,
} from '../../controllers/aiStudio.controller.js';
import {
  getMeasurements as getSizeMeasurements,
  saveMeasurements as saveSizeMeasurements,
  generateImage as generateSizeImage,
} from '../../controllers/productSizeImage.controller.js';
import { upload, uploadEnhanceImage } from '../../middleware/upload.js';
import { aiStudioRateLimiter } from '../../middleware/rateLimit.js';
import { requirePermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/products.
export const adminProductsRouter = Router();

adminProductsRouter.use(requirePermission('products'));
adminProductsRouter.get('/', adminList);
adminProductsRouter.post('/', adminCreate);
// Registered before "/:id" — Express would otherwise treat "images" as an id.
adminProductsRouter.get('/images/library', listAllImages);
// Before the '/:id' routes so 'bulk-collection' isn't read as a product id.
adminProductsRouter.post('/bulk-collection', bulkSetCollection);
adminProductsRouter.get('/:id', adminGet);
adminProductsRouter.patch('/:id', adminUpdate);
adminProductsRouter.delete('/:id', adminDelete);
adminProductsRouter.patch('/:id/price-lock', setPriceLock);
adminProductsRouter.patch('/:id/featured', setFeatured);
adminProductsRouter.patch('/:id/best-seller', setBestSeller);

// Variant editor (attribute + variant model) — per-combination stock/
// weight/availability, each with its own live price.
adminProductsRouter.get('/:id/variants', listVariants);
// Registered before "/:id/variants/:variantId" — Express would otherwise
// treat "bulk" as a variantId.
adminProductsRouter.patch('/:id/variants/bulk', bulkUpdateVariants);
adminProductsRouter.patch('/:id/variants/:variantId', updateVariant);

// Availability Rules — per-product pairwise combination exclusions.
adminProductsRouter.get('/:id/exclusion-rules', listExclusionRules);
adminProductsRouter.post('/:id/exclusion-rules', createExclusionRule);
adminProductsRouter.delete('/:id/exclusion-rules/:ruleId', deleteExclusionRule);

// Weight Defaults — Purity and Purity+Size live weight resolution levels.
adminProductsRouter.get('/:id/weight-rules', getWeightRules);
adminProductsRouter.put('/:id/weight-rules', replaceWeightRules);

// Purity Pricing Rules — Product+Purity making-charge/discount overrides.
adminProductsRouter.get('/:id/purity-pricing-rules', getPurityPricingRules);
adminProductsRouter.put('/:id/purity-pricing-rules', replacePurityPricingRules);

// Product photo gallery (plan §9/§10).
adminProductsRouter.get('/:id/images', listImages);
adminProductsRouter.post('/:id/images', upload.single('image'), uploadOriginal);
adminProductsRouter.post('/:id/images/attach', attachExisting);
adminProductsRouter.patch('/:id/images/reorder', reorder);
adminProductsRouter.patch('/:id/images/:sortOrder/primary', setPrimary);
adminProductsRouter.delete('/:id/images/:sortOrder', removeImage);

// AI image job workflow (plan §10).
adminProductsRouter.get('/:id/ai-images', getStatus);
adminProductsRouter.post('/:id/ai-images/regenerate', regenerate);
adminProductsRouter.post('/:id/ai-images/:imageId/approve', approve);
adminProductsRouter.post('/:id/ai-images/:imageId/reject', reject);

// AI Image Studio — separate, deliberately opt-in pipeline (upload -> analyse
// & confirm -> choose presenter -> generate N images -> review & import).
// /active is registered before the /:jobId param route below, or Express
// would treat "active" as a jobId.
adminProductsRouter.get('/:id/ai-studio/active', getActiveStudioJob);
adminProductsRouter.get('/:id/ai-studio/pending-review', getStudioPendingReview);
adminProductsRouter.post(
  '/:id/ai-studio',
  aiStudioRateLimiter,
  uploadEnhanceImage.array('images', 4),
  createStudioJob,
);
adminProductsRouter.get('/:id/ai-studio/:jobId', getStudioJob);
adminProductsRouter.post('/:id/ai-studio/:jobId/confirm', aiStudioRateLimiter, confirmStudioJob);
adminProductsRouter.post('/:id/ai-studio/:jobId/prompt-preview', aiStudioRateLimiter, previewStudioPrompts);
adminProductsRouter.post(
  '/:id/ai-studio/:jobId/assets/:assetId/retry',
  aiStudioRateLimiter,
  retryStudioAsset,
);
// Gents-only: regenerates a fresh master identity and both Gents presenter
// shots together — see changeGentsPresenter's own comment for why this is
// separate from the generic per-asset retry endpoint above.
adminProductsRouter.post(
  '/:id/ai-studio/:jobId/gents-presenter/change',
  aiStudioRateLimiter,
  changeGentsPresenter,
);
adminProductsRouter.patch('/:id/ai-studio/:jobId/assets/:assetId', updateStudioAssetSelection);
adminProductsRouter.post('/:id/ai-studio/:jobId/assets/:assetId/import', importStudioAsset);
adminProductsRouter.post('/:id/ai-studio/:jobId/import/complete', completeStudioImport);
adminProductsRouter.post('/:id/ai-studio/:jobId/cancel', cancelStudioJob);

// Product Size Image — a fully decoupled generation pipeline (own job/
// table, not part of ai_studio_jobs/ai_studio_assets) reachable both from
// inside the wizard above and from any existing product at any time.
adminProductsRouter.get('/:id/size-measurements', getSizeMeasurements);
adminProductsRouter.put('/:id/size-measurements', saveSizeMeasurements);
adminProductsRouter.post('/:id/size-measurements/generate', aiStudioRateLimiter, generateSizeImage);
