import type { HomepageSectionType } from '../../api/types';

// Recommended upload sizes per homepage section, matched to the shape each
// section actually displays on the storefront (see web/src/pages/home/*.css).
// `desktop`/`mobile` label the item form's upload fields; `summary` is the
// one-line hint on the section panel. null desktop = section takes no
// uploaded images.
export interface ImageSizeHint {
  summary: string;
  desktop: string | null;
  mobile: string | null;
}

export const IMAGE_SIZE_HINTS: Record<HomepageSectionType, ImageSizeHint> = {
  HERO: {
    summary: 'Desktop 1600 × 500 px (wide strip) · Mobile 800 × 1000 px (portrait 4:5)',
    desktop: '1600 × 500 px, wide strip',
    mobile: '800 × 1000 px, portrait 4:5',
  },
  BENTO_CATEGORIES: {
    summary: "No upload here — uses each category's own image (square, 400 × 400 px, set on the Categories page)",
    desktop: null,
    mobile: null,
  },
  NEW_ARRIVALS: {
    summary: 'Banner 1080 × 1350 px (portrait 4:5)',
    desktop: '1080 × 1350 px, portrait 4:5',
    mobile: '1080 × 1350 px, portrait 4:5 (optional)',
  },
  COLLECTION_CARDS: {
    summary:
      '3 items: item 1 ≈ 1600 × 660 px, items 2–3 ≈ 1480 × 320 px · 2 items: 1520 × 880 px each · 4+ items: 800 × 1000 px (4:5). Text is written over these images — keep the subject centred.',
    desktop: 'see sizes above for this section (depends on how many items)',
    mobile: 'optional — same shape as desktop',
  },
  SHOP_BY_MATERIAL: {
    summary: 'Square 600 × 600 px',
    desktop: '600 × 600 px, square',
    mobile: 'not needed',
  },
  FEATURED_PRODUCT: {
    summary: 'No upload — uses the featured products’ own photos',
    desktop: null,
    mobile: null,
  },
  BEST_SELLERS: {
    summary: 'Portrait 800 × 1000 px (4:5)',
    desktop: '800 × 1000 px, portrait 4:5',
    mobile: 'not needed',
  },
  SHOP_BY_PRICE: {
    summary: 'No images — text price cards',
    desktop: null,
    mobile: null,
  },
  OCCASION_CARDS: {
    summary:
      '3 items: item 1 ≈ 1600 × 660 px, items 2–3 ≈ 1480 × 320 px · 2 items: 1520 × 880 px each · 4+ items: 800 × 1000 px (4:5). Text is written over these images — keep the subject centred.',
    desktop: 'see sizes above for this section (depends on how many items)',
    mobile: 'optional — same shape as desktop',
  },
  INSTAGRAM: {
    summary: 'Square 800 × 800 px',
    desktop: '800 × 800 px, square',
    mobile: 'not needed',
  },
  NEWSLETTER: {
    summary: 'No images',
    desktop: null,
    mobile: null,
  },
  TRUST_STRIP: {
    summary: 'No images — icons are built in',
    desktop: null,
    mobile: null,
  },
  CAMPAIGN_BANNERS: {
    summary: 'Portrait 600 × 840 px (5:7)',
    desktop: '600 × 840 px, portrait 5:7',
    mobile: 'not needed',
  },
  CATEGORY_PRODUCTS: {
    summary: 'No upload — shows the category’s product photos',
    desktop: null,
    mobile: null,
  },
  COLLECTION_SHOWCASE: {
    summary: 'Desktop 1920 × 600 px (wide 3.2:1) · Mobile 1200 × 900 px (4:3)',
    desktop: '1920 × 600 px, wide 3.2:1',
    mobile: '1200 × 900 px, 4:3',
  },
  SHOP_BY_BOND: {
    summary: 'Portrait 600 × 800 px (3:4)',
    desktop: '600 × 800 px, portrait 3:4',
    mobile: 'not needed',
  },
  BANNER_TRIO: {
    summary: 'Item 1: 1200 × 1200 px (square) · Items 2–3: 1250 × 590 px (wide ~2.1:1)',
    desktop: 'item 1: 1200 × 1200 px square · items 2–3: 1250 × 590 px',
    mobile: 'optional — same shape as desktop',
  },
  IMAGE_MOSAIC: {
    summary: 'Items 1 & 4 (tall): 900 × 1200 px (portrait 3:4) · Items 2 & 3 (middle): 1000 × 600 px (5:3)',
    desktop: 'items 1 & 4: 900 × 1200 px tall (3:4) · items 2 & 3: 1000 × 600 px',
    mobile: 'not needed',
  },
  PRICE_SHOWCASE: {
    summary: '800 × 700 px per card (slightly wider than tall, 8:7) — product centred with space around it',
    desktop: '800 × 700 px (8:7)',
    mobile: 'not needed',
  },
  VIDEO_STORY: {
    summary: 'Video: landscape 16:9 (1920 × 1080), MP4, under 50 MB · Cover image: 1920 × 1080 px',
    desktop: 'cover shown before the video plays: 1920 × 1080 px, 16:9',
    mobile: 'not needed',
  },
  COLLECTION_CAROUSEL: {
    summary: 'Square 1000 × 1000 px',
    desktop: '1000 × 1000 px, square',
    mobile: 'not needed',
  },
};
