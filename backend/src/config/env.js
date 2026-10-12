import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL,

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174').split(
    ',',
  ),

  adminSessionSecret: process.env.ADMIN_SESSION_SECRET ?? 'dev-only-admin-session-secret',
  adminSessionCookieName: process.env.ADMIN_SESSION_COOKIE_NAME ?? 'box_diamonds_admin_sid',
  adminSessionMaxAgeHours: Number(process.env.ADMIN_SESSION_MAX_AGE_HOURS ?? 12),

  customerSessionSecret: process.env.CUSTOMER_SESSION_SECRET ?? 'dev-only-customer-session-secret',
  customerSessionCookieName:
    process.env.CUSTOMER_SESSION_COOKIE_NAME ?? 'box_diamonds_customer_sid',
  // Customers shouldn't be re-prompted for OTP on every visit (plan §11) — long-lived vs admin's 12h.
  customerSessionMaxAgeHours: Number(process.env.CUSTOMER_SESSION_MAX_AGE_HOURS ?? 24 * 30),

  // Unset by default: an unset cookie `domain` scopes to the exact host,
  // which is fine locally (one host, "localhost", shared across dev's
  // different frontend ports). Deployments split across subdomains (e.g.
  // admin.example.com / example.com both calling api.example.com) must set
  // this to the shared parent, e.g. ".example.com", or the browser will
  // never send the session cookie back on cross-subdomain requests.
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,

  guestCartSessionCookieName: process.env.GUEST_CART_SESSION_COOKIE_NAME ?? 'box_diamonds_cart_sid',
  guestCartSessionMaxAgeDays: Number(process.env.GUEST_CART_SESSION_MAX_AGE_DAYS ?? 90),

  rateLimitWindowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES ?? 15),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 300),
  adminLoginRateLimitMax: Number(process.env.ADMIN_LOGIN_RATE_LIMIT_MAX ?? 10),

  // OTP (plan §7/§12/§13)
  otpProvider: process.env.OTP_PROVIDER ?? 'stub',
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? 5),
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 30),
  otpMaxVerifyAttempts: Number(process.env.OTP_MAX_VERIFY_ATTEMPTS ?? 5),
  otpMaxRequestsPerHour: Number(process.env.OTP_MAX_REQUESTS_PER_HOUR ?? 5),
  otpMaxRequestsPerDay: Number(process.env.OTP_MAX_REQUESTS_PER_DAY ?? 10),
  otpSendRateLimitPerIp: Number(process.env.OTP_SEND_RATE_LIMIT_PER_IP ?? 20),

  msg91AuthKey: process.env.MSG91_AUTH_KEY,
  msg91TemplateId: process.env.MSG91_TEMPLATE_ID,
  msg91SenderId: process.env.MSG91_SENDER_ID,

  // Live Pricing Engine (plan §9a). metalRateProvider is a dev/test escape
  // hatch only: set to "stub" to bypass real network calls entirely (local
  // dev default). Any other value is ignored by goldRateService, which
  // always tries OroPocket first, then GoldAPI, then the last known rate —
  // see goldRateService.js for the real provider-priority chain.
  metalRateProvider: process.env.METAL_RATE_PROVIDER ?? 'stub',
  goldRateSyncCron: process.env.GOLD_RATE_SYNC_CRON ?? '*/15 * * * *', // every 15 minutes
  // Pricing Rule Management (Phase 2) — flips SCHEDULED->ACTIVE and
  // ACTIVE->EXPIRED on a tick; resolution never depends on this having run
  // (pricingRuleResolver.isLive derives real liveness from the rule's own
  // dates), so a slower tick only affects audit-log/UI freshness.
  pricingRuleStatusSweepCron: process.env.PRICING_RULE_STATUS_SWEEP_CRON ?? '*/5 * * * *',
  goldapiAccessToken: process.env.GOLDAPI_ACCESS_TOKEN,
  // GoldAPI quotes the raw international spot price with no Indian import
  // duty applied — see metalRateProvider.goldapi.js for the live comparison
  // that confirmed this against OroPocket's actual domestic quote.
  goldapiImportDutyPercent: Number(process.env.GOLDAPI_IMPORT_DUTY_PERCENT ?? 16),

  // OroPocket — primary gold-rate source (no API key). GoldAPI above is kept
  // as a temporary fallback until OroPocket is proven stable in production.
  oropocketBaseUrl: process.env.OROPOCKET_BASE_URL ?? 'https://api.oropocket.com',
  metalRateFetchTimeoutMs: Number(process.env.METAL_RATE_FETCH_TIMEOUT_MS ?? 8000),
  metalRateFetchRetries: Number(process.env.METAL_RATE_FETCH_RETRIES ?? 2), // extra attempts after the first
  metalRateRetryBaseDelayMs: Number(process.env.METAL_RATE_RETRY_BASE_DELAY_MS ?? 400),
  // If a freshly fetched 24K rate differs from the last applied rate by more
  // than this percentage, it's rejected/logged for review instead of applied
  // automatically — overridable per-installation via gold_rate_settings, this
  // is only the seed default for that table's max_deviation_percent column.
  goldRateMaxDeviationPercent: Number(process.env.GOLD_RATE_MAX_DEVIATION_PERCENT ?? 10),
  // Best-effort OroPocket-vs-GoldAPI comparison logging while migrating off
  // GoldAPI (spec §13) — fetches GoldAPI in parallel purely for the
  // gold_rate_sync_runs audit row even when OroPocket already succeeded.
  // Never blocks or fails the sync; can be turned off once migration is done.
  goldRateComparisonLoggingEnabled: process.env.GOLD_RATE_COMPARISON_LOGGING !== 'false',

  // Checkout / inventory reservation (plan §11)
  reservationTtlMinutes: Number(process.env.RESERVATION_TTL_MINUTES ?? 15),
  reservationSweepCron: process.env.RESERVATION_SWEEP_CRON ?? '* * * * *', // every minute
  shippingEstimateMinDays: Number(process.env.SHIPPING_ESTIMATE_MIN_DAYS ?? 3),
  shippingEstimateMaxDays: Number(process.env.SHIPPING_ESTIMATE_MAX_DAYS ?? 7),

  // Payment (plan §11)
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'stub',
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET ?? 'dev-only-payment-webhook-secret',

  // Cashfree — real payment provider. Sandbox by default; CASHFREE_ENV
  // must be explicitly set to PRODUCTION to go live. The webhook signature
  // is verified with the same CASHFREE_SECRET_KEY used for API auth —
  // Cashfree doesn't issue a separate webhook secret.
  cashfreeAppId: process.env.CASHFREE_APP_ID,
  cashfreeSecretKey: process.env.CASHFREE_SECRET_KEY,
  cashfreeApiVersion: process.env.CASHFREE_API_VERSION ?? '2023-08-01',
  cashfreeEnv: process.env.CASHFREE_ENV ?? 'SANDBOX',

  // Base URL of the customer-facing storefront (plan §11 Cashfree) — used
  // to build the payment gateway's post-payment return_url. Not the API's
  // own URL/PORT above.
  webAppBaseUrl: process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173',

  // Shipping (plan §11b)
  shippingProvider: process.env.SHIPPING_PROVIDER ?? 'stub',
  shippingWebhookSecret: process.env.SHIPPING_WEBHOOK_SECRET ?? 'dev-only-shipping-webhook-secret',

  // Delhivery — real courier provider (Phase 3). Only read when
  // SHIPPING_PROVIDER=delhivery. Poll-based tracking (no inbound webhook
  // from Delhivery, unlike payment's push model) — see
  // jobs/shipmentTrackingSyncJob.js. Base URL defaults to Delhivery's
  // staging/sandbox host; set DELHIVERY_BASE_URL to the production host to
  // go live, same pattern as CASHFREE_ENV switching base URLs.
  delhiveryApiToken: process.env.DELHIVERY_API_TOKEN,
  delhiveryBaseUrl: process.env.DELHIVERY_BASE_URL ?? 'https://staging-express.delhivery.com',
  delhiveryPickupLocation: process.env.DELHIVERY_PICKUP_LOCATION ?? 'Box Diamonds Warehouse',
  delhiveryTrackingSyncCron: process.env.DELHIVERY_TRACKING_SYNC_CRON ?? '*/15 * * * *',

  // Reverse pickup (return-to-warehouse) — Delhivery's create-shipment API
  // treats these as the shipment's `return_*` fields (where the courier
  // drops the item off), distinct from DELHIVERY_PICKUP_LOCATION (a
  // registered warehouse *name* only, used for forward shipments). Defaults
  // fall back to the same warehouse name/no-address so a missing .env value
  // fails loudly at the Delhivery API call rather than silently.
  delhiveryReturnName: process.env.DELHIVERY_RETURN_NAME ?? process.env.DELHIVERY_PICKUP_LOCATION ?? 'Box Diamonds Warehouse',
  delhiveryReturnAddress: process.env.DELHIVERY_RETURN_ADDRESS ?? '',
  delhiveryReturnPincode: process.env.DELHIVERY_RETURN_PINCODE ?? '',
  delhiveryReturnCity: process.env.DELHIVERY_RETURN_CITY ?? '',
  delhiveryReturnState: process.env.DELHIVERY_RETURN_STATE ?? '',
  delhiveryReturnPhone: process.env.DELHIVERY_RETURN_PHONE ?? '',

  // Blue Dart — second real courier, selectable per shipment from admin's
  // Create Shipment dialog. Only offered once BLUEDART_CLIENT_ID and
  // BLUEDART_LOGIN_ID are both set (see shippingProvider.bluedart.js's
  // isConfigured). Values come from Blue Dart's API Gateway onboarding; the
  // base URL defaults to their sandbox (UAT) host until production is set.
  // Where storefront Contact Us submissions are emailed.
  contactInboxEmail: process.env.CONTACT_INBOX_EMAIL ?? 'info@boxdiamonds.com',

  bluedartBaseUrl: process.env.BLUEDART_BASE_URL ?? 'https://apigateway-sandbox.bluedart.com',
  bluedartClientId: process.env.BLUEDART_CLIENT_ID,
  bluedartClientSecret: process.env.BLUEDART_CLIENT_SECRET,
  bluedartLoginId: process.env.BLUEDART_LOGIN_ID,
  bluedartLicenceKey: process.env.BLUEDART_LICENCE_KEY,
  bluedartCustomerCode: process.env.BLUEDART_CUSTOMER_CODE,
  bluedartOriginArea: process.env.BLUEDART_ORIGIN_AREA,
  bluedartProductCode: process.env.BLUEDART_PRODUCT_CODE ?? 'A',
  bluedartSubProductCode: process.env.BLUEDART_SUB_PRODUCT_CODE ?? 'P',
  bluedartShipperName: process.env.BLUEDART_SHIPPER_NAME ?? 'Box Diamonds',
  bluedartShipperAddress: process.env.BLUEDART_SHIPPER_ADDRESS ?? '',
  bluedartShipperPincode: process.env.BLUEDART_SHIPPER_PINCODE ?? '',
  bluedartShipperPhone: process.env.BLUEDART_SHIPPER_PHONE ?? '',

  // Storage + AI image pipeline (plan §2/§9/§10)
  storageProvider: process.env.STORAGE_PROVIDER ?? 'local',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  uploadsPublicBaseUrl: process.env.UPLOADS_PUBLIC_BASE_URL ?? 'http://localhost:4000/uploads',
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB ?? 10),
  // Unboxing/return videos are much larger than a product image — separate,
  // higher default limit rather than raising maxUploadSizeMb for everything.
  maxReturnVideoSizeMb: Number(process.env.MAX_RETURN_VIDEO_SIZE_MB ?? 100),
  aiImageProvider: process.env.AI_IMAGE_PROVIDER ?? 'stub',

  // S3 storage provider — only read when STORAGE_PROVIDER=s3. Credentials
  // come from the environment (or, if unset on an EC2 host, the instance's
  // attached IAM role via the SDK's default credential chain — never
  // hardcoded). s3PublicBaseUrl defaults to the bucket's virtual-hosted-style
  // URL but can be overridden to a CloudFront/custom domain later without
  // any code change.
  s3Bucket: process.env.S3_BUCKET,
  s3Region: process.env.S3_REGION ?? 'ap-south-1',
  s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL || null,

  // Jewellery photo quality enhancement — OpenAI Images Edit API, called
  // directly (not through the aiImage provider registry above, which is a
  // different feature: candidate redesign variants vs. this single
  // preserve-the-design enhancement pass).
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2',
  // No default — AI Image Studio's analysis step must be deliberately
  // configured, not silently pinned to whatever model happened to be
  // hardcoded here (plan §9 correction).
  openaiVisionModel: process.env.OPENAI_VISION_MODEL,

  // AI Image Studio (jewellery reference upload -> 4-image generation).
  aiStudioCategoryConfidenceThreshold: Number(
    process.env.AI_STUDIO_CATEGORY_CONFIDENCE_THRESHOLD ?? 0.7,
  ),
  aiStudioGenerationConcurrency: Number(process.env.AI_STUDIO_GENERATION_CONCURRENCY ?? 4),

  // Product Size Image (deterministic ruler overlay) — decoupled from AI
  // Studio above. sharp's trim() threshold for detecting the product's
  // bounding box against its generated background; retunable without a
  // redeploy since real-world model output drifts over time.
  productSizeImageTrimThreshold: Number(process.env.PRODUCT_SIZE_IMAGE_TRIM_THRESHOLD ?? 12),

  // Email (plan §12)
  emailProvider: process.env.EMAIL_PROVIDER ?? 'stub',
  emailJobRetryLimit: Number(process.env.EMAIL_JOB_RETRY_LIMIT ?? 5),
  // Meta Conversions API (server-side Purchase events). Disabled unless both
  // are set; META_CAPI_TEST_CODE routes events to Events Manager → Test
  // events only (leave unset in normal operation).
  metaPixelId: process.env.META_PIXEL_ID ?? '',
  metaCapiAccessToken: process.env.META_CAPI_ACCESS_TOKEN ?? '',
  metaCapiTestCode: process.env.META_CAPI_TEST_CODE ?? '',
  emailJobRetryDelaySeconds: Number(process.env.EMAIL_JOB_RETRY_DELAY_SECONDS ?? 30),

  // AWS SES — real email provider. Only read when EMAIL_PROVIDER=ses.
  // Credentials reuse AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (same vars
  // s3AccessKeyId/s3SecretAccessKey below already read) rather than a
  // second dedicated pair — one IAM identity covering both S3 and SES is
  // the common case; if unset, the SDK's default credential chain applies
  // (an attached IAM role), same as storageProvider.s3.js.
  sesRegion: process.env.SES_REGION ?? 'ap-south-1',
  sesFromEmail: process.env.SES_FROM_EMAIL,
  sesFromName: process.env.SES_FROM_NAME ?? 'BOX Diamonds',

  // Generic SMTP — real email provider, only read when EMAIL_PROVIDER=smtp.
  // No sandbox/per-recipient-verification restriction the way a brand-new
  // SES account has, at the cost of whatever the mailbox's own daily
  // sending limit is (e.g. Gmail's ~500/day with an App Password).
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFromEmail: process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER,
  smtpFromName: process.env.SMTP_FROM_NAME ?? 'BOX Diamonds',
};

export const isProduction = env.nodeEnv === 'production';
