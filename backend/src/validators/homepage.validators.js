import { z } from 'zod';

// Matches the section types the storefront renderer understands (plan §3
// homepage structure) — free text at the DB level, enforced here.
// INSTAGRAM and NEWSLETTER are no longer offered on the homepage.
const SECTION_TYPES = [
  'HERO',
  'BENTO_CATEGORIES',
  'NEW_ARRIVALS',
  'COLLECTION_CARDS',
  'SHOP_BY_MATERIAL',
  'FEATURED_PRODUCT',
  'BEST_SELLERS',
  'SHOP_BY_PRICE',
  'OCCASION_CARDS',
  'TRUST_STRIP',
  'CAMPAIGN_BANNERS',
  'CATEGORY_PRODUCTS',
  // One full-width collection banner + up to 10 of that collection's
  // products (two rows of 5 on desktop) — distinct from COLLECTION_CARDS
  // (a 2-3 tile banner grid with no products at all).
  'COLLECTION_SHOWCASE',
  // Portrait photo tiles with a label underneath (Mother, Wife, Brother…),
  // each linking to a collection/category — 3 per row on mobile, 6 on desktop.
  'SHOP_BY_BOND',
  // 1 large square banner (left) + 2 wide banners stacked (right), image-only
  // (the artwork carries its own text) — each banner fully clickable.
  'BANNER_TRIO',
  // Square collection images in a looping carousel — 3 visible on desktop
  // with the centre one enlarged, arrows + autoplay, swipe on mobile —
  // with the section's own subtitle and "View All" button.
  'COLLECTION_CAROUSEL',
  // 4 images: tall (left) · 2 stacked with captions (middle) · tall (right),
  // with the section's title + subtitle above.
  'IMAGE_MOSAIC',
  // One uploaded video beside the section's title, subtitle and optional
  // button (e.g. a look inside the manufacturing process).
  'VIDEO_STORY',
  // Photo cards per price band ("Under ₹5,000" … "Above ₹30,000"), each
  // opening /jewellery filtered to that band (worked out from its label).
  'PRICE_SHOWCASE',
];

export const createSectionSchema = z.object({
  type: z.enum(SECTION_TYPES),
  heading: z.string().trim().max(200).nullable().optional(),
  isEnabled: z.boolean().optional(),
});

export const updateSectionSchema = z.object({
  heading: z.string().trim().max(200).nullable().optional(),
  // Optional section subtitle + button (used by the Collections Carousel).
  subheading: z.string().trim().max(300).nullable().optional(),
  ctaLabel: z.string().trim().max(100).nullable().optional(),
  ctaUrl: z.string().trim().max(500).nullable().optional(),
  isEnabled: z.boolean().optional(),
});

// The complete list of section (or item) ids in their new order. Ids, not
// sort_order values: two rows sharing a sort_order made the old value-based
// swap move both rows at once and scramble the list.
export const reorderSchema = z.object({
  order: z.array(z.string().uuid()).min(1),
});

// Hero Banner-only fields (every other section type's admin form never sends
// these, so they simply stay at their column defaults — NONE/false/true —
// for every other item). Kept in the same shared schema rather than a
// separate one so create/update still go through the one generic
// createItem/updateItem endpoint.
export const HERO_REDIRECT_TYPES = ['NONE', 'CATEGORY', 'COLLECTION', 'PRODUCT'];

export const createItemSchema = z.object({
  imageUrl: z.string().trim().max(500).nullable().optional(),
  imageUrlMobile: z.string().trim().max(500).nullable().optional(),
  videoUrl: z.string().trim().max(500).nullable().optional(),
  heading: z.string().trim().max(200).nullable().optional(),
  subheading: z.string().trim().max(400).nullable().optional(),
  ctaLabel: z.string().trim().max(100).nullable().optional(),
  ctaUrl: z.string().trim().max(500).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  collectionId: z.string().uuid().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  name: z.string().trim().max(200).nullable().optional(),
  redirectType: z.enum(HERO_REDIRECT_TYPES).optional(),
  openInNewTab: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});

export const updateItemSchema = createItemSchema.partial();
