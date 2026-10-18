import { Router } from 'express';
import {
  getGoldRates,
  syncGoldRates,
  preview,
  getGoldRateSettings,
  putGoldRateSettings,
  postManualGoldRate,
} from '../../controllers/pricing.controller.js';
import { goldRateSyncRateLimiter } from '../../middleware/rateLimit.js';
import {
  list as listRules,
  get as getRule,
  create as createRule,
  update as updateRule,
  remove as removeRule,
  activate as activateRule,
  disable as disableRule,
  previewUnsaved as previewUnsavedRule,
  previewSaved as previewSavedRule,
  reprice as repriceRule,
  getRepriceJob,
  listRepriceJobs,
  listAudit,
} from '../../controllers/pricingRules.controller.js';
import { list as listProductOverrides, bulk as bulkProductOverrides } from '../../controllers/productOverrides.controller.js';
import { requirePermission } from '../../middleware/adminAuth.js';

// Mounted at /api/v1/admin/pricing.
export const adminPricingRouter = Router();

adminPricingRouter.use(requirePermission('pricing'));
adminPricingRouter.get('/gold-rates', getGoldRates);
adminPricingRouter.post('/gold-rates/sync', goldRateSyncRateLimiter, syncGoldRates);
adminPricingRouter.get('/gold-rate-settings', getGoldRateSettings);
adminPricingRouter.put('/gold-rate-settings', putGoldRateSettings);
adminPricingRouter.post('/gold-rate-settings/manual-rate', postManualGoldRate);
adminPricingRouter.post('/preview', preview);

// Pricing Rule Management (Phase 3).
adminPricingRouter.get('/rules', listRules);
adminPricingRouter.post('/rules', createRule);
adminPricingRouter.post('/rules/preview', previewUnsavedRule);
adminPricingRouter.get('/rules/:ruleId', getRule);
adminPricingRouter.put('/rules/:ruleId', updateRule);
adminPricingRouter.delete('/rules/:ruleId', removeRule);
adminPricingRouter.post('/rules/:ruleId/activate', activateRule);
adminPricingRouter.post('/rules/:ruleId/disable', disableRule);
adminPricingRouter.post('/rules/:ruleId/preview', previewSavedRule);
adminPricingRouter.post('/rules/:ruleId/reprice', repriceRule);

adminPricingRouter.get('/reprice-jobs', listRepriceJobs);
adminPricingRouter.get('/reprice-jobs/:jobId', getRepriceJob);

adminPricingRouter.get('/product-overrides', listProductOverrides);
adminPricingRouter.patch('/product-overrides/bulk', bulkProductOverrides);

adminPricingRouter.get('/audit', listAudit);
