export interface Admin {
  id: string;
  email: string;
  fullName: string;
  role: { id: string; name: string; permissions: string[] };
}

export type MetalType = 'GOLD' | 'PLATINUM';
export type Purity = '9K' | '14K' | '18K' | '22K' | '24K';
export type GoldColor = 'YELLOW' | 'ROSE' | 'WHITE';
export type ProductStatus = 'DRAFT' | 'AI_PROCESSING' | 'AI_READY' | 'PUBLISHED' | 'FAILED';

export interface ProductListItem {
  id: string;
  slug: string;
  categorySlug: string | null;
  name: string;
  metalType: MetalType;
  purity: Purity | null;
  goldColor: GoldColor | null;
  sellingPrice: number;
  mrp: number;
  discountPercent: number;
  primaryImageUrl: string | null;
  availableStock: number;
  ratingAvg: number;
  ratingCount: number;
  isFeatured: boolean;
  isBestSeller: boolean;
  status?: ProductStatus;
  // Admin list only — the collection this product is in, if any.
  collectionId?: string | null;
}

export interface ProductImage {
  id: string;
  type: 'ORIGINAL' | 'AI_GENERATED';
  variant: string;
  format: string;
  url: string;
  isPrimary: boolean;
}

export interface ProductSize {
  id: string;
  label: string;
  stockQuantity: number;
  availableStock: number;
  weightGrams: number | null;
  diamondWeightCarats: number | null;
}

export interface ProductSizeInput {
  label: string;
  stockQuantity: number;
  weightGrams: number | null;
  diamondWeightCarats: number | null;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  sku: string;
  categoryId: string | null;
  collectionId: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  metalType: MetalType;
  purity: Purity | null;
  goldColor: GoldColor | null;
  grossWeightGrams: number | null;
  netWeightGrams: number | null;
  goldWeightGrams: number | null;
  diamondWeightGrams: number | null;
  diamondWeightCarats: number | null;
  diamondConfigId: string | null;
  diamondCount: number | null;
  diamondTypeId: string | null;
  diamondType: string | null;
  diamondColour: string | null;
  diamondClarity: string | null;
  gemstone: string | null;
  certification: string | null;
  productSize: string | null;
  // Overrides the "Size" wording on the admin form and storefront (e.g.
  // "Length" for a chain) — null means plain "Size".
  sizeLabel: string | null;
  careInstructions: string | null;
  priceBreakup: {
    goldValue: number;
    diamondValue: number;
    diamondValueOriginal: number;
    makingCharge: number;
    makingChargeOriginal: number;
    makingChargeDiscountPercent: number;
    diamondDiscountPercent: number;
    gstAmount: number;
    total: number;
  };
  // Admin-set % of gold value this product's making charge is computed from
  // (null for products still on a flat making-charge, e.g. platinum, or
  // never migrated to percent-based pricing) — the source of truth for live
  // recalculation; priceBreakup.makingCharge above is just its computed
  // result at the current gold rate/purity/size.
  makingChargePercent: number | null;
  gstPercent: number;
  mrp: number;
  sellingPrice: number;
  sellingPriceOriginal: number;
  discountPercent: number;
  offerLabel: string | null;
  stockQuantity: number;
  availableStock: number;
  status: ProductStatus;
  isPriceLocked: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  showDeliveryChecker: boolean;
  isNonReturnable: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  ratingAvg: number;
  ratingCount: number;
  images: ProductImage[];
  sizes: ProductSize[];

  goldColorOptions: GoldColor[];
  purityOptions: Purity[];
  diamondOptions: { id: string; name: string }[];

  // Generic attribute+value catalogue this product currently offers —
  // what Availability Rules picks its two sides from. Same data as
  // goldColorOptions/purityOptions/diamondOptions/sizes above, just
  // attribute-count-agnostic.
  attributes: ProductAttributeGroup[];
}

export interface ProductAttributeGroup {
  code: string;
  name: string;
  values: { id: string; value: string; label: string; refId: string | null }[];
}

export interface ProductInput {
  name: string;
  sku: string;
  categoryId?: string | null;
  collectionId?: string | null;
  shortDescription?: string | null;
  fullDescription?: string | null;
  metalType: MetalType;
  purity?: Purity | null;
  goldColor?: GoldColor | null;
  goldWeightGrams?: number | null;
  diamondWeightGrams?: number | null;
  diamondWeightCarats?: number | null;
  diamondConfigId?: string | null;
  diamondCount?: number | null;
  diamondTypeId?: string | null;
  diamondType?: string | null;
  diamondColour?: string | null;
  diamondClarity?: string | null;
  gemstone?: string | null;
  certification?: string | null;
  productSize?: string | null;
  sizeLabel?: string | null;
  careInstructions?: string | null;
  goldValue?: number;
  diamondValue?: number;
  diamondValueIsManual?: boolean;
  makingCharge?: number;
  makingChargePercent?: number | null;
  gstPercent?: number;
  mrp?: number;
  sellingPrice?: number;
  makingChargeDiscountPercent?: number;
  diamondDiscountPercent?: number;
  stockQuantity?: number;
  status?: ProductStatus;
  showDeliveryChecker?: boolean;
  isNonReturnable?: boolean;
  slug?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  sizes?: ProductSizeInput[];

  goldColors?: GoldColor[];
  purities?: Purity[];
  diamondConfigIds?: string[];

  // Per-exact-combination overrides applied in the same save that sets up
  // the axes above — lets a brand-new product be fully configured (stock/
  // weight/availability per combination) without a separate trip into the
  // variant editor afterward. Sent only by the "Add Product" create flow.
  variantOverrides?: VariantOverrideInput[];

  // Weight Defaults / Purity Pricing Rules, entered in the same continuous
  // product form and saved by the one Save Product action — keyed by purity
  // code / size label (never a database UUID; the backend resolves those
  // itself from `purities`/`sizes` above). Omitting a field entirely on an
  // update means "leave the saved rules untouched"; sending an explicit
  // empty array/collection means "clear them" — see
  // productsService.js's applyWeightAndPricingRulesInTx.
  weightRules?: WeightRulesInput;
  purityPricingRules?: PurityPricingRuleInput[];
}

export interface WeightRulesInput {
  purityRules: { purity: Purity; goldWeightGrams: number }[];
  puritySizeRules: { purity: Purity; sizeLabel: string; goldWeightGrams: number }[];
}

export interface PurityPricingRuleInput {
  purity: Purity;
  // null = inherit the product-level default for this one field; a number
  // (including 0) is an explicit override — never coerced to 0 on omission.
  makingChargePercent: number | null;
  makingChargeDiscountPercent: number | null;
  diamondDiscountPercent: number | null;
}

export interface VariantOverrideInput {
  attributeValues: {
    goldColor?: GoldColor;
    purity?: Purity;
    diamondConfigId?: string;
    sizeLabel?: string;
  };
  stockQuantity?: number;
  goldWeightGrams?: number | null;
  diamondWeightGrams?: number | null;
  diamondWeightCarats?: number | null;
  isAvailable?: boolean;
}

// Admin always gets the full banner state (including `enabled` and any
// saved values while disabled) so the edit form can populate its inputs —
// unlike the storefront's Category type, which collapses a disabled/unset
// banner straight to `null`.
export interface CategoryBanner {
  enabled: boolean;
  eyebrow: string | null;
  description: string | null;
  imageUrl: string | null;
  imageUrlMobile: string | null;
  altText: string | null;
  textColor: 'LIGHT' | 'DARK';
  textPosition: 'LEFT' | 'CENTER' | 'RIGHT';
  focalPosition: 'LEFT' | 'CENTER' | 'RIGHT';
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  // Products in this category (and subcategories) can't be returned for a
  // change of mind — Return & Refund Policy exclusions.
  isNonReturnable: boolean;
  sortOrder: number;
  banner: CategoryBanner;
  seoTitle: string | null;
  seoDescription: string | null;
  seoHeading: string | null;
}

// What create/update actually accept — flat fields (matching
// categories.validators.js's schema) rather than Category's nested `banner`
// GET shape, since the backend has no nested-object input handling.
export interface CategoryInput {
  parentId: string | null;
  name: string;
  slug?: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isNonReturnable: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  seoHeading: string | null;
  bannerEnabled: boolean;
  bannerEyebrow: string | null;
  bannerDescription: string | null;
  bannerImageUrl: string | null;
  bannerImageUrlMobile: string | null;
  bannerAltText: string | null;
  bannerTextColor: 'LIGHT' | 'DARK';
  bannerTextPosition: 'LEFT' | 'CENTER' | 'RIGHT';
  bannerFocalPosition: 'LEFT' | 'CENTER' | 'RIGHT';
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

export interface PricingPreviewResult {
  goldValue: number;
  diamondValue: number;
  makingCharge: number;
  gstPercent: number;
  sellingPrice: number;
}

// Raw DB rows — these two admin pricing endpoints return columns as-is
// (snake_case, NUMERIC as string) rather than mapping to a camelCase DTO.
export interface GoldRateRow {
  id: string;
  purity: Purity;
  rate_per_gram: string;
  source: string;
  fetched_at: string;
}

export type GoldRateSource = 'AUTOMATIC' | 'MANUAL';
export type GoldRateAdjustmentType = 'NONE' | 'FIXED' | 'PERCENTAGE';

export interface GoldRateSettingsRow {
  id: string;
  source: GoldRateSource;
  adjustment_type: GoldRateAdjustmentType;
  adjustment_value: string;
  max_deviation_percent: string;
  updated_at: string;
  updated_by_admin_id: string | null;
}

export interface GoldRateSyncRunRow {
  id: string;
  trigger: 'CRON' | 'MANUAL';
  primary_provider: string;
  primary_status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  primary_rate: string | null;
  primary_error: string | null;
  fallback_provider: string | null;
  fallback_status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  fallback_rate: string | null;
  fallback_error: string | null;
  resolved_provider: string | null;
  base_rate_24k: string | null;
  adjustment_type: GoldRateAdjustmentType;
  adjustment_value: string;
  effective_rate_24k: string | null;
  status: 'SUCCESS' | 'FAILED' | 'REJECTED';
  applied: boolean;
  rejected_reason: string | null;
  created_at: string;
}

export interface GoldRateOverview {
  settings: GoldRateSettingsRow;
  currentRates: GoldRateRow[];
  latestSyncRun: GoldRateSyncRunRow | null;
}

export interface DiamondConfig {
  id: string;
  name: string;
  ratePerCent: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DiamondType {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiamondTypeInput {
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}

// --- Pricing Rule Management ---

export type PricingRuleType = 'MAKING_CHARGE' | 'DIAMOND';
export type PricingRuleScope = 'GLOBAL' | 'CATEGORY' | 'PRODUCT';
export type PricingDiscountType = 'PERCENT' | 'FIXED_AMOUNT' | 'FIXED_AMOUNT_PER_CARAT';
export type PricingRuleStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'DISABLED';
export type PricingOverrideMode = 'PRESERVE' | 'SUPPRESS';
export type PricingConditionType = 'DIAMOND_QUALITY' | 'DIAMOND_COLOUR' | 'DIAMOND_CLARITY' | 'CARAT_RANGE';

export interface PricingRuleCondition {
  conditionType: PricingConditionType;
  stringValues: string[] | null;
  minValue: number | null;
  maxValue: number | null;
}

export interface PricingRule {
  id: string;
  ruleType: PricingRuleType;
  name: string;
  scope: PricingRuleScope;
  discountType: PricingDiscountType;
  discountValue: number;
  purityScope: 'ALL' | 'SELECTED';
  purityValueIds: string[];
  overrideMode: PricingOverrideMode;
  startsAt: string | null;
  endsAt: string | null;
  status: PricingRuleStatus;
  priority: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  categoryIds: string[];
  productIds: string[];
  diamondTypeIds: string[];
  conditions: PricingRuleCondition[];
}

// What create/update actually accept — a subset of PricingRule's fields,
// all optional on update (matches pricingRules.validators.js exactly).
export interface PricingRuleInput {
  ruleType: PricingRuleType;
  name: string;
  scope: PricingRuleScope;
  discountType: PricingDiscountType;
  discountValue: number;
  purityScope?: 'ALL' | 'SELECTED';
  purityValueIds?: string[];
  overrideMode?: PricingOverrideMode;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: PricingRuleStatus;
  priority?: number;
  notes?: string | null;
  categoryIds?: string[];
  productIds?: string[];
  diamondTypeIds?: string[];
  conditions?: PricingRuleCondition[];
}

export interface RulePreviewPriceBreakdown {
  makingCharge: number;
  diamondValue: number;
  gst: number;
  sellingPrice: number;
}

export interface RulePreviewSample {
  productId: string;
  sku: string;
  name: string;
  before: RulePreviewPriceBreakdown;
  after: RulePreviewPriceBreakdown;
}

export interface RulePreviewResult {
  totalProductsInScope: number;
  eligibleCount: number;
  matchingDiamondTypeCount: number | null;
  withExistingOverrides: number;
  willReceiveRule: number;
  clampedCount: number;
  suppressedCount: number;
  excluded: { reason: string; count: number }[];
  missingPricingData: { productId: string; sku: string; missing: string[] }[];
  samples: RulePreviewSample[];
}

export type RepriceJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'CANCELLED';

export interface RepriceJob {
  id: string;
  ruleId: string | null;
  ruleNameSnapshot: string | null;
  trigger: string;
  status: RepriceJobStatus;
  totalCount: number;
  processedCount: number;
  changedCount: number;
  failedCount: number;
  failures: { productId: string; sku: string; message: string }[];
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

// --- Product Overrides (Phase 5) ---

export interface ProductOverride {
  id: string;
  sku: string;
  name: string;
  slug: string;
  categoryId: string | null;
  categoryName: string | null;
  diamondTypeId: string | null;
  diamondTypeName: string | null;
  flatMakingChargeDiscountPercent: number;
  flatDiamondDiscountPercent: number;
  effectiveMakingChargeDiscountPercent: number | null;
  effectiveDiamondDiscountPercent: number | null;
  effectiveMakingChargeRuleId: string | null;
  effectiveDiamondRuleId: string | null;
  hasMakingOverride: boolean;
  hasDiamondOverride: boolean;
  hasRestorableOverride: boolean;
}

export type ProductOverrideBulkAction =
  | 'REMOVE_MAKING_OVERRIDE'
  | 'REMOVE_DIAMOND_OVERRIDE'
  | 'DISABLE_OVERRIDES'
  | 'RESTORE_PREVIOUS_OVERRIDES';

// --- Pricing Audit History (Phase 6) ---

export type PricingAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'ACTIVATED'
  | 'DEACTIVATED'
  | 'SCHEDULED'
  | 'EXPIRED'
  | 'DELETED'
  | 'REPRICE_STARTED'
  | 'REPRICE_COMPLETED'
  | 'REPRICE_FAILED'
  | 'OVERRIDE_REMOVED'
  | 'OVERRIDE_RESTORED'
  | 'BULK_OVERRIDE_ACTION';

export interface PricingAuditEntry {
  id: string;
  ruleId: string | null;
  ruleNameSnapshot: string | null;
  ruleType: PricingRuleType | null;
  action: PricingAuditAction;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  affectedProductCount: number | null;
  productId: string | null;
  productName: string | null;
  productSku: string | null;
  adminUserId: string | null;
  adminName: string | null;
  createdAt: string;
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

// The order's own fulfilment stage — what both admin and customer read as
// "the" order status (backend/src/utils/orderStatus.js's ORDER_STATUSES).
// null until payment succeeds (no fulfilment stage exists yet).
export type OrderStatus =
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELAYED'
  | 'DELIVERY_FAILED'
  | 'RETURN_INITIATED'
  | 'RETURNED'
  | 'CANCELLED';

export type ShipmentStatus =
  | 'NOT_CREATED'
  | 'SHIPMENT_CREATED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'REACHED_DESTINATION'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELAYED'
  | 'DELIVERY_FAILED'
  | 'RTO_INITIATED'
  | 'RETURNED'
  | 'CANCELLED';

// The Orders list filter dropdown spans payment_status and order_status —
// PENDING_PAYMENT/PAYMENT_FAILED are payment states with no order_status yet.
// REFUND_PENDING: cancelled/returned but still PAID (refund not yet issued).
export type StatusFilterValue = 'PENDING_PAYMENT' | 'PAYMENT_FAILED' | 'REFUND_PENDING' | OrderStatus;

// Server-computed 8-10 calendar-day window, frozen onto the order at
// checkout (backend/src/services/deliveryEstimateService.js /
// checkoutService.js) — never recalculated once the order exists.
export interface DeliveryEstimate {
  minimumDays: number;
  maximumDays: number;
  earliestDate: string;
  latestDate: string;
  timezone: string;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus | null;
  shipmentStatus: ShipmentStatus;
  contactName: string;
  contactMobile: string;
  totalAmount: number;
  createdAt: string;
  productName: string | null;
  itemCount: number;
  deliveryEstimate: DeliveryEstimate | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  categoryName: string | null;
  productImageUrl: string | null;
  productImageLargeUrl: string | null;
  diamondCount: number | null;
  quantity: number;
  goldValue: number;
  diamondValue: number;
  makingCharge: number;
  gstAmount: number;
  unitPrice: number;
  lineTotal: number;
  sizeLabel: string | null;
  goldColor: string | null;
  purity: string | null;
  diamondConfigName: string | null;
  goldWeightGrams: number | null;
  diamondWeightCarats: number | null;
  diamondColour: string | null;
  diamondClarity: string | null;
  customizationNote: string | null;
  isBackordered: boolean;
  metalType: 'GOLD' | 'PLATINUM' | null;
  netWeightGrams: number | null;
  grossWeightGrams: number | null;
  diamondWeightGrams: number | null;
  gemstone: string | null;
}

export interface OrderStatusHistoryEntry {
  status: string;
  note: string | null;
  createdAt: string;
  // Admin-only ("employee assignments" stay hidden from customers, per
  // backend/src/utils/orderDto.js's forAdmin flag) — always present here
  // since admin always fetches via findOrderStatusHistoryForAdmin.
  source: 'ADMIN' | 'PAYMENT_GATEWAY' | 'DELHIVERY' | 'SYSTEM';
  actorName: string | null;
}

export interface ShippingAddress {
  type: string;
  name: string;
  mobileNumber: string;
  addressLine: string;
  building: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface ShipmentTrackingEvent {
  id: string;
  status: string;
  location: string | null;
  note: string | null;
  source: 'MANUAL' | 'SYSTEM' | 'WEBHOOK' | 'DELHIVERY';
  createdAt: string;
}

export interface Shipment {
  id: string;
  provider: string;
  trackingNumber: string | null;
  courierName: string | null;
  status: string;
  packageWeightGrams: number | null;
  packageLengthCm: number | null;
  packageWidthCm: number | null;
  packageHeightCm: number | null;
  lastTrackedAt: string | null;
  trackingEvents: ShipmentTrackingEvent[];
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus | null;
  shipmentStatus: ShipmentStatus;
  contactName: string;
  contactMobile: string;
  contactEmail: string;
  shippingAddress: ShippingAddress;
  deliveryNote: string | null;
  deliveryEstimate: DeliveryEstimate | null;
  subtotal: number;
  discountAmount: number;
  couponCode: string | null;
  gstAmount: number;
  shippingAmount: number;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
  statusHistory: OrderStatusHistoryEntry[];
  shipment: Shipment | null;
  canPrintWorkOrder: boolean;
  workOrderPrintCount: number;
  canPrintInvoice: boolean;
  invoiceNumber: string | null;
  invoicePrintCount: number;
  // Returned order whose items haven't been put back in stock yet.
  canRestock?: boolean;
  // Cashfree identifiers used to refund from the Cashfree dashboard.
  paymentDetails?: {
    provider: string;
    gatewayOrderId: string | null;
    transactionId: string | null;
    bankReference?: string | null;
    paymentMethod?: string | null;
    paymentTime?: string | null;
    amount: number;
    lookupFailed: boolean;
  } | null;
  returnRequest: ReturnRequest | null;
  reversePickup: ReversePickup | null;
}

export type ReturnReason = 'DAMAGED' | 'DEFECTIVE' | 'WRONG_ITEM' | 'NOT_AS_DESCRIBED' | 'CHANGED_MIND' | 'OTHER';
export type ReturnRequestStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';

export interface ReturnRequest {
  id: string;
  reason: ReturnReason;
  note: string | null;
  videoUrl: string | null;
  photoUrls?: string[];
  status: ReturnRequestStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByAdminName: string | null;
}

export type ReversePickupStatus =
  | 'REVERSE_PICKUP_SCHEDULED'
  | 'REVERSE_PICKED_UP'
  | 'REVERSE_IN_TRANSIT'
  | 'REVERSE_RECEIVED'
  | 'REVERSE_PICKUP_FAILED'
  | 'REVERSE_PICKUP_CANCELLED';

export interface ReversePickup {
  id: string;
  provider: string;
  courierName: string | null;
  trackingNumber: string | null;
  status: ReversePickupStatus;
  createdAt: string;
  lastTrackedAt: string | null;
}

export interface WorkOrderResponse {
  order: OrderDetail;
  processingStartedAt: string | null;
  printCount: number;
  lastPrintedAt: string | null;
}

export interface InvoiceResponse {
  order: OrderDetail;
  invoiceNumber: string;
  invoiceGeneratedAt: string;
  printCount: number;
}

export interface Customer {
  id: string;
  mobileNumber: string;
  fullName: string | null;
  email: string | null;
  createdAt: string;
}

export type HomepageSectionType =
  | 'HERO'
  | 'BENTO_CATEGORIES'
  | 'NEW_ARRIVALS'
  | 'COLLECTION_CARDS'
  | 'SHOP_BY_MATERIAL'
  | 'FEATURED_PRODUCT'
  | 'BEST_SELLERS'
  | 'SHOP_BY_PRICE'
  | 'OCCASION_CARDS'
  | 'INSTAGRAM'
  | 'NEWSLETTER'
  | 'TRUST_STRIP'
  | 'CAMPAIGN_BANNERS'
  | 'CATEGORY_PRODUCTS'
  | 'COLLECTION_SHOWCASE'
  | 'SHOP_BY_BOND'
  | 'BANNER_TRIO'
  | 'COLLECTION_CAROUSEL'
  | 'IMAGE_MOSAIC'
  | 'VIDEO_STORY'
  | 'PRICE_SHOWCASE';

export type HeroRedirectType = 'NONE' | 'CATEGORY' | 'COLLECTION' | 'PRODUCT';

export interface HomepageItem {
  id: string;
  imageUrl: string | null;
  imageUrlMobile: string | null;
  // Video Story section only — the uploaded MP4/WebM.
  videoUrl: string | null;
  heading: string | null;
  subheading: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  categoryId: string | null;
  collectionId: string | null;
  productId: string | null;
  // Hero Banner-only fields — unused (and left at their defaults: null /
  // 'NONE' / false / true) by every other section type's items.
  name: string | null;
  redirectType: HeroRedirectType;
  openInNewTab: boolean;
  isEnabled: boolean;
  sortOrder: number;
}

export interface HomepageSection {
  id: string;
  type: HomepageSectionType;
  heading: string | null;
  subheading?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  isEnabled: boolean;
  sortOrder: number;
  items: HomepageItem[];
}

export interface HomepageSectionUpdate {
  heading?: string | null;
  subheading?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  isEnabled?: boolean;
}

export interface HomepageItemInput {
  imageUrl?: string | null;
  imageUrlMobile?: string | null;
  videoUrl?: string | null;
  heading?: string | null;
  subheading?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  categoryId?: string | null;
  collectionId?: string | null;
  productId?: string | null;
  name?: string | null;
  redirectType?: HeroRedirectType;
  openInNewTab?: boolean;
  isEnabled?: boolean;
}

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  reviewerName: string;
  reviewerMobile: string;
  productName: string;
  productSlug: string;
  createdAt: string;
  images: string[];
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: number;
  minOrderValue: number;
  usageLimitTotal: number | null;
  usageLimitPerUser: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  usageCount: number | null;
  createdAt: string;
}

export interface CouponInput {
  code?: string;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
  minOrderValue?: number;
  usageLimitTotal?: number | null;
  usageLimitPerUser?: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

export interface AuditLogEntry {
  id: string;
  adminUserId: string | null;
  adminEmail: string | null;
  adminFullName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminRole {
  id: string;
  name: string;
  permissions: string[];
  // Only present on the list response (GET /admin-users/roles) — create/
  // update return the bare role without it.
  adminUserCount?: number;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  role: { id: string; name: string; permissions: string[] };
  createdAt: string;
}

export interface AdminUserInput {
  email?: string;
  password?: string;
  fullName?: string;
  roleId?: string;
  isActive?: boolean;
}

export interface AdminRoleInput {
  name?: string;
  permissions?: string[];
}
