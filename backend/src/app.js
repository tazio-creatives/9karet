import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { env } from './config/env.js';
import { createSessionMiddleware } from './config/session.js';
import { healthRouter } from './routes/health.routes.js';
import { contactRouter } from './routes/contact.routes.js';
import { deliveryRouter } from './routes/delivery.routes.js';
import { blogRouter } from './routes/blog.routes.js';
import { adminAuthRouter } from './routes/adminAuth.routes.js';
import { otpRouter } from './routes/otp.routes.js';
import { customersRouter } from './routes/customers.routes.js';
import { cartRouter } from './routes/cart.routes.js';
import { wishlistRouter } from './routes/wishlist.routes.js';
import { addressesRouter } from './routes/addresses.routes.js';
import { checkoutRouter } from './routes/checkout.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { paymentWebhookRouter } from './routes/paymentWebhook.routes.js';
import { ordersRouter } from './routes/orders.routes.js';
import { shippingWebhookRouter } from './routes/shippingWebhook.routes.js';
import { productsRouter } from './routes/products.routes.js';
import { categoriesRouter } from './routes/categories.routes.js';
import { collectionsRouter } from './routes/collections.routes.js';
import { searchRouter } from './routes/search.routes.js';
import { homepageRouter } from './routes/homepage.routes.js';
import { adminProductsRouter } from './routes/admin/products.routes.js';
import { adminAttributesRouter } from './routes/admin/attributes.routes.js';
import { adminImageEnhancementRouter } from './routes/admin/imageEnhancement.routes.js';
import { adminCategoriesRouter } from './routes/admin/categories.routes.js';
import { adminCollectionsRouter } from './routes/admin/collections.routes.js';
import { adminPricingRouter } from './routes/admin/pricing.routes.js';
import { adminPresentersRouter } from './routes/admin/presenters.routes.js';
import { adminShippingRouter } from './routes/admin/shipping.routes.js';
import { adminOrdersRouter } from './routes/admin/orders.routes.js';
import { adminDashboardRouter } from './routes/admin/dashboard.routes.js';
import { adminCustomersRouter } from './routes/admin/customers.routes.js';
import { adminHomepageRouter } from './routes/admin/homepage.routes.js';
import { adminReviewsRouter } from './routes/admin/reviews.routes.js';
import { productReviewsRouter } from './routes/productReviews.routes.js';
import { reviewsRouter } from './routes/reviews.routes.js';
import { couponsRouter } from './routes/coupons.routes.js';
import { adminCouponsRouter } from './routes/admin/coupons.routes.js';
import { adminAuditLogsRouter } from './routes/admin/auditLogs.routes.js';
import { adminContactMessagesRouter } from './routes/admin/contactMessages.routes.js';
import { adminBlogRouter } from './routes/admin/blog.routes.js';
import { adminUsersRouter } from './routes/admin/adminUsers.routes.js';
import { adminDisplayOrderRouter } from './routes/admin/displayOrder.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { loadAdmin, requireAdminAuth } from './middleware/adminAuth.js';
import { loadCustomer } from './middleware/customerAuth.js';
import { ensureGuestCartSession } from './middleware/guestCartSession.js';
import { requireCsrfHeader } from './middleware/csrf.js';
import { auditLog } from './middleware/auditLog.js';
import { apiRateLimiter } from './middleware/rateLimit.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));

  // Signature-verified webhooks need the raw request body (plan §11) — must
  // be mounted before express.json() below, or the JSON parser consumes the
  // stream first and the exact bytes the signature was computed over are
  // lost to re-serialization.
  app.use('/api/v1/payments', paymentWebhookRouter);
  app.use('/api/v1/shipping', shippingWebhookRouter);

  // helmet's default Cross-Origin-Resource-Policy (same-origin) would block
  // the storefront/admin origins from loading <img> bytes served here —
  // product images are meant to be publicly loadable cross-origin.
  app.use(
    '/uploads',
    (req, res, next) => {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(path.resolve(process.cwd(), env.uploadDir), { maxAge: '7d' }),
  );

  app.use(express.json());
  app.use(cookieParser());
  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  }
  app.use(apiRateLimiter);

  // Cheap (cookie only, no DB) — issued to every visitor regardless of
  // route, ready for Phase 9's cart/wishlist (plan §11/§27).
  app.use(ensureGuestCartSession);

  app.use('/api/v1', healthRouter);
  app.use('/api/v1/contact', contactRouter);
  app.use('/api/v1/delivery', deliveryRouter);

  // Public catalog (products/categories/collections/search): deliberately
  // NOT behind the customer session middleware — these are GET-only, and
  // every hit would otherwise pay a Postgres round-trip (connect-pg-simple)
  // just to discover the visitor is anonymous. [PERF] matters more here than
  // knowing who's browsing; a later phase can add optional customer-awareness
  // (e.g. wishlist hearts on PDP) if that turns out to be worth the cost.
  const publicCatalogRouter = express.Router();
  publicCatalogRouter.use('/products', productsRouter);
  publicCatalogRouter.use('/categories', categoriesRouter);
  publicCatalogRouter.use('/collections', collectionsRouter);
  publicCatalogRouter.use('/search', searchRouter);
  publicCatalogRouter.use('/homepage', homepageRouter);
  publicCatalogRouter.use('/blog', blogRouter);
  app.use('/api/v1', publicCatalogRouter);

  // Admin and customer sessions are two entirely separate express-session
  // stores/cookies (plan §8) — each is scoped to its own route prefix rather
  // than both mounted globally, since express-session hardcodes req.session
  // and a rename-after-the-fact approach breaks regenerate()/destroy() (they
  // reassign req.session directly via closures captured at middleware-setup
  // time). Scoping by path keeps exactly one session type active per request.
  const adminSession = createSessionMiddleware({
    tableName: 'admin_sessions',
    cookieName: env.adminSessionCookieName,
    secret: env.adminSessionSecret,
    maxAgeHours: env.adminSessionMaxAgeHours,
  });
  app.use('/api/v1/auth/admin', adminSession, loadAdmin, requireCsrfHeader, adminAuthRouter);

  // Before adminCatalogRouter: that router's middleware (incl. the generic
  // audit log) runs for every /api/v1/admin request that enters it.
  app.use(
    '/api/v1/admin/display-order',
    adminSession,
    loadAdmin,
    requireAdminAuth,
    requireCsrfHeader,
    adminDisplayOrderRouter,
  );

  const adminCatalogRouter = express.Router();
  adminCatalogRouter.use(adminSession, loadAdmin, requireAdminAuth, requireCsrfHeader, auditLog);
  adminCatalogRouter.use('/products', adminProductsRouter);
  adminCatalogRouter.use('/attributes', adminAttributesRouter);
  adminCatalogRouter.use('/image-enhancement', adminImageEnhancementRouter);
  adminCatalogRouter.use('/categories', adminCategoriesRouter);
  adminCatalogRouter.use('/collections', adminCollectionsRouter);
  adminCatalogRouter.use('/pricing', adminPricingRouter);
  adminCatalogRouter.use('/presenters', adminPresentersRouter);
  adminCatalogRouter.use('/shipping', adminShippingRouter);
  adminCatalogRouter.use('/orders', adminOrdersRouter);
  adminCatalogRouter.use('/dashboard', adminDashboardRouter);
  adminCatalogRouter.use('/customers', adminCustomersRouter);
  adminCatalogRouter.use('/homepage', adminHomepageRouter);
  adminCatalogRouter.use('/reviews', adminReviewsRouter);
  adminCatalogRouter.use('/coupons', adminCouponsRouter);
  adminCatalogRouter.use('/audit-logs', adminAuditLogsRouter);
  adminCatalogRouter.use('/contact-messages', adminContactMessagesRouter);
  adminCatalogRouter.use('/blog', adminBlogRouter);
  adminCatalogRouter.use('/admin-users', adminUsersRouter);
  app.use('/api/v1/admin', adminCatalogRouter);

  const customerSession = createSessionMiddleware({
    tableName: 'customer_sessions',
    cookieName: env.customerSessionCookieName,
    secret: env.customerSessionSecret,
    maxAgeHours: env.customerSessionMaxAgeHours,
  });
  const customerRouter = express.Router();
  customerRouter.use(customerSession, loadCustomer, requireCsrfHeader);
  customerRouter.use('/otp', otpRouter);
  customerRouter.use('/customers', customersRouter);
  customerRouter.use('/cart', cartRouter);
  customerRouter.use('/wishlist', wishlistRouter);
  customerRouter.use('/addresses', addressesRouter);
  customerRouter.use('/checkout', checkoutRouter);
  customerRouter.use('/payments', paymentsRouter);
  customerRouter.use('/orders', ordersRouter);
  customerRouter.use('/coupons', couponsRouter);
  customerRouter.use('/products/:id/reviews', productReviewsRouter);
  customerRouter.use('/reviews', reviewsRouter);
  app.use('/api/v1', customerRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
