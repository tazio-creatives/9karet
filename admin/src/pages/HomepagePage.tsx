import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  fetchHomepageSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
} from '../api/homepage';
import type {
  HomepageItem,
  HomepageItemInput,
  HomepageSection,
  HomepageSectionType,
  HomepageSectionUpdate,
} from '../api/types';
import { HomepageItemForm } from '../features/homepage/HomepageItemForm';
import { HeroBannerForm } from '../features/homepage/HeroBannerForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FirstFiftyManager } from '../features/displayOrder/FirstFiftyManager';
import { IMAGE_SIZE_HINTS } from '../features/homepage/imageSizes';
import sharedStyles from '../styles/shared.module.css';
import styles from './HomepagePage.module.css';

// Section types whose tiles are auto-derived server-side (from categories /
// products tables) rather than manually curated per homepage_item — see
// homepage.repository.js's getEnabledSectionsWithItems. Keep in sync with
// that file's special-cased section types.
const AUTO_SYNCED_TYPES: HomepageSectionType[] = ['BENTO_CATEGORIES', 'FEATURED_PRODUCT'];

// Only the current homepage design's sections can be added. Older types
// (Shop by Category, New Arrivals, Curated Collections, Instagram, etc.)
// are no longer offered; any existing section of an old type still shows
// in the list below with its name, and can be edited or deleted.
const SECTION_TYPES: HomepageSectionType[] = [
  'HERO',
  'CATEGORY_STRIP',
  'PRODUCT_TABS',
  'COLLECTION_SPOTLIGHT',
  'EDIT_BANNERS',
  'PRODUCT_GRID',
  'PRODUCT_ROW',
  'SHOP_BY_PRICE',
  'SHOP_BY_BOND',
  'FULL_WIDTH_BANNER',
  'BANNER_TRIO',
];

// Friendly names matching the actual storefront headings — the raw type
// name (e.g. "OCCASION CARDS") doesn't read as "Shop by Occasion", which
// made the option hard to find by eye in the Add Section dropdown.
const SECTION_TYPE_LABELS: Record<HomepageSectionType, string> = {
  HERO: 'Slider (sliding banners at the top of the homepage)',
  PRODUCT_TABS: 'Product Tabs (New Arrivals / Trending / Bestsellers + promo card)',
  COLLECTION_SPOTLIGHT: 'Our Collections (tall collection cards, scrolling sideways)',
  CATEGORY_STRIP: 'Category Strip (row of rounded category photos with the name underneath — you choose the categories)',
  FULL_WIDTH_BANNER: 'Full Width Banner (one edge-to-edge image banner, no products)',
  PRODUCT_ROW: 'Product Row (heading + short description + one scrolling row of products from a category or collection)',
  PRODUCT_GRID: 'Product Grid (heading + 2 rows of products from a category or collection + View All button)',
  EDIT_BANNERS: 'Collection Edit Banners (2 wide banners side by side — small label, big title, "Discover more" link)',
  BENTO_CATEGORIES: 'Shop by Category (category tiles + products of the chosen category)',
  NEW_ARRIVALS: 'New Arrivals (one banner + 10 newest products)',
  COLLECTION_CARDS: 'Curated Collections (2–3 large image tiles)',
  SHOP_BY_MATERIAL: 'Shop by Material (grid of small image tiles)',
  FEATURED_PRODUCT: 'Featured Products (product slider, 4 per view)',
  BEST_SELLERS: 'Best Sellers (scrolling row of image tiles)',
  SHOP_BY_PRICE: 'Shop by Budget (square photo cards — "Under 10k", "Under 20k"…)',
  OCCASION_CARDS: 'Shop by Occasion (2–3 large image tiles)',
  INSTAGRAM: 'Instagram Feed (scrolling row of small photos)',
  NEWSLETTER: 'Newsletter (heading + email signup box)',
  TRUST_STRIP: 'Trust Strip (row of trust badges with icons)',
  CAMPAIGN_BANNERS: 'Campaign Banners (row of promotional banners)',
  CATEGORY_PRODUCTS: 'Category Products (5 newest products per category)',
  COLLECTION_SHOWCASE: 'Banner with Products (collection banner + up to 15 products underneath)',
  SHOP_BY_BOND: 'Shop by Bond (square photo cards — "Mother", "Wife"… same design as Shop by Budget)',
  BANNER_TRIO: 'Banner Trio (1 large square banner + 2 wide banners stacked, image only)',
  COLLECTION_CAROUSEL: 'Collections Carousel (square images sliding, 3 visible — centre one larger, with View All button)',
  IMAGE_MOSAIC: 'Jewellery Mosaic (tall image · 2 stacked images with captions · tall image)',
  PRICE_SHOWCASE: 'Shop by Price — Photo Cards (pastel cards with photo, price and Shop Now — 5 across)',
  VIDEO_STORY: 'Video Story (large title + text + button beside a video with play button)',
};

function imageForItem(item: HomepageItem): string | null {
  return item.imageUrl;
}

// Names aren't attached to the raw category/collection/product ids on a
// HomepageItem row (only the id is stored) — a plain "Product" label is good
// enough for this compact list row; the full name is shown once the admin
// opens Edit, where HeroBannerForm resolves it via its own queries.
function heroRedirectSummary(item: HomepageItem): string {
  switch (item.redirectType) {
    case 'CATEGORY':
      return 'Redirects to a Category';
    case 'COLLECTION':
      return 'Redirects to a Collection';
    case 'PRODUCT':
      return 'Redirects to a Product';
    default:
      return 'No Redirect';
  }
}

// The section-level heading — most section types render it as the
// section's title on the storefront (Hero/banner types don't). Captioned
// explicitly so it isn't confused with the per-item Heading fields.
function SectionHeadingInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <div>
      <input
        className={styles.headingInput}
        value={draft}
        placeholder="Section heading"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
      />
      <span className={styles.headingHint}>
        Shown as the section title on the storefront for most section types (leave empty for no title)
      </span>
    </div>
  );
}

// Section subtitle (+ optional "View All" button) — Collections Carousel
// and Jewellery Mosaic.
function CarouselSettings({
  section,
  onSave,
  showButton = true,
}: {
  section: HomepageSection;
  onSave: (_input: HomepageSectionUpdate) => void;
  showButton?: boolean;
}) {
  const [subheading, setSubheading] = useState(section.subheading ?? '');
  const [ctaLabel, setCtaLabel] = useState(section.ctaLabel ?? '');
  const [ctaUrl, setCtaUrl] = useState(section.ctaUrl ?? '');
  const dirty =
    subheading !== (section.subheading ?? '') || ctaLabel !== (section.ctaLabel ?? '') || ctaUrl !== (section.ctaUrl ?? '');
  return (
    <div className={`${sharedStyles.formGrid} ${sharedStyles.cardPadded}`} style={{ marginBottom: 'var(--space-3)' }}>
      <label className={sharedStyles.field}>
        Subtitle — small grey line under the title (put the main title in "Section heading" above)
        <input
          value={subheading}
          onChange={(e) => setSubheading(e.target.value)}
          placeholder="Find your style. Explore our diverse collections!"
        />
      </label>
      {showButton && (
        <>
          <label className={sharedStyles.field}>
            Button text (empty = no button)
            <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="View All Collections" />
          </label>
          <label className={sharedStyles.field}>
            Button link
            <input
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="/collections/signature-collection"
            />
          </label>
        </>
      )}
      <div style={{ alignSelf: 'end' }}>
        <button
          type="button"
          className={sharedStyles.buttonPrimary}
          disabled={!dirty}
          onClick={() =>
            onSave({ subheading: subheading.trim() || null, ctaLabel: ctaLabel.trim() || null, ctaUrl: ctaUrl.trim() || null })
          }
        >
          Save settings
        </button>
      </div>
    </div>
  );
}

export function HomepagePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-homepage'], queryFn: fetchHomepageSections });

  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<HomepageItem | null>(null);
  const [orderingCollectionId, setOrderingCollectionId] = useState<string | null>(null);
  const [newSectionType, setNewSectionType] = useState<HomepageSectionType>('HERO');
  const [pendingDeleteSection, setPendingDeleteSection] = useState<HomepageSection | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-homepage'] });

  const createSectionMutation = useMutation({
    mutationFn: () => createSection(newSectionType),
    onSuccess: invalidate,
  });
  const updateSectionMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: HomepageSectionUpdate }) =>
      updateSection(id, input),
    onSuccess: invalidate,
  });
  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) => deleteSection(id),
    onSuccess: () => {
      invalidate();
      setPendingDeleteSection(null);
    },
  });
  const reorderSectionsMutation = useMutation({
    mutationFn: (order: string[]) => reorderSections(order),
    onSuccess: invalidate,
  });

  const createItemMutation = useMutation({
    mutationFn: ({ sectionId, input }: { sectionId: string; input: HomepageItemInput }) =>
      createItem(sectionId, input),
    onSuccess: () => {
      invalidate();
      setAddingItemTo(null);
    },
  });
  const updateItemMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: HomepageItemInput }) => updateItem(id, input),
    onSuccess: () => {
      invalidate();
      setEditingItem(null);
    },
  });
  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: invalidate,
  });
  const reorderItemsMutation = useMutation({
    mutationFn: ({ sectionId, order }: { sectionId: string; order: string[] }) => reorderItems(sectionId, order),
    onSuccess: invalidate,
  });

  if (isLoading) return <p>Loading…</p>;
  const sections = data?.sections ?? [];

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const order = sections.map((s) => s.id);
    [order[index], order[target]] = [order[target], order[index]];
    reorderSectionsMutation.mutate(order);
  }

  function moveItem(section: HomepageSection, index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= section.items.length) return;
    const order = section.items.map((it) => it.id);
    [order[index], order[target]] = [order[target], order[index]];
    reorderItemsMutation.mutate({ sectionId: section.id, order });
  }

  return (
    <div>
      <div className={sharedStyles.pageHeader}>
        <h1 className={sharedStyles.pageTitle}>Homepage</h1>
        <div className={styles.addSectionRow}>
          <select value={newSectionType} onChange={(e) => setNewSectionType(e.target.value as HomepageSectionType)}>
            {SECTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {SECTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={sharedStyles.buttonPrimary}
            disabled={createSectionMutation.isPending}
            onClick={() => createSectionMutation.mutate()}
          >
            Add Section
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {sections.map((section, i) => (
          <div key={section.id} className={sharedStyles.card}>
            <div className={styles.sectionRow}>
              <div className={styles.moveButtons}>
                <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button type="button" onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1}>
                  ↓
                </button>
              </div>

              <div className={styles.sectionInfo}>
                <p className={styles.sectionType}>{SECTION_TYPE_LABELS[section.type]}</p>
                {IMAGE_SIZE_HINTS[section.type] && (
                  <p className={styles.sizeHint}>📐 Image size: {IMAGE_SIZE_HINTS[section.type].summary}</p>
                )}
                <SectionHeadingInput
                  value={section.heading ?? ''}
                  onCommit={(heading) => updateSectionMutation.mutate({ id: section.id, input: { heading } })}
                />
              </div>

              <span className={section.isEnabled ? sharedStyles.badgeSuccess : sharedStyles.badgeNeutral}>
                {section.isEnabled ? 'Enabled' : 'Disabled'}
              </span>

              <div className={styles.sectionActions}>
                <button
                  type="button"
                  className={sharedStyles.buttonLink}
                  onClick={() =>
                    updateSectionMutation.mutate({ id: section.id, input: { isEnabled: !section.isEnabled } })
                  }
                >
                  {section.isEnabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  className={sharedStyles.buttonLink}
                  onClick={() => setPendingDeleteSection(section)}
                >
                  Delete
                </button>
              </div>
            </div>

            {section.type === 'BENTO_CATEGORIES' && (
              <div className={styles.itemsPanel}>
                <p className={sharedStyles.empty}>
                  Tiles for this section are generated automatically from your active top-level categories (manage
                  them on the Categories page — name, image, and order there control what shows here). There's
                  nothing to add or edit in this panel.
                </p>
              </div>
            )}

            {section.type === 'FEATURED_PRODUCT' && (
              <div className={styles.itemsPanel}>
                <p className={sharedStyles.empty}>
                  This section shows whichever products you've marked "Featured" on the Products page (use the star
                  button on each row). There's nothing to add or edit in this panel.
                </p>
              </div>
            )}

            {!AUTO_SYNCED_TYPES.includes(section.type) && (
              <div className={styles.itemsPanel}>
                {section.type === 'HERO' && (
                  <p className={sharedStyles.empty}>
                    Each item below is one slide of the Slider. The uploaded image already contains its own heading, description
                    and call-to-action artwork — nothing is overlaid on top of it. Choose what the whole slide links
                    to (or "No Redirect" to make it a plain, non-clickable image), and use Status to hide a slide
                    without deleting it.
                  </p>
                )}
                {section.type === 'NEW_ARRIVALS' && (
                  <p className={sharedStyles.empty}>
                    Add exactly one item for the feature banner — only the first item renders. Heading is the
                    banner title, Subheading the line below it (leave both blank to use the default "New Arrivals /
                    From festive sparkle to everyday essentials" copy). Upload the banner photo as "Banner image —
                    desktop" (and optionally a portrait crop as "mobile"). Link to Category/Collection/Product and
                    CTA fields aren't used here. The products shown below the banner are always the 10 most recently
                    published products and update automatically.
                  </p>
                )}
                {section.type === 'CATEGORY_PRODUCTS' && (
                  <p className={sharedStyles.empty}>
                    Add one item per category using "Link to Category" below — its heading/image/product/CTA fields
                    aren't used here. The 5 most recently published products in that category (and its
                    subcategories) show automatically and stay up to date on their own.
                  </p>
                )}
                {section.type === 'COLLECTION_SHOWCASE' && (
                  <p className={sharedStyles.empty}>
                    Add exactly one item using "Link to Collection" below — only the first item renders. The banner
                    title comes from the collection's own name automatically (don't retype it). Heading shows as a
                    small eyebrow line above the title, Subheading as the description below it, and CTA Label/desktop
                    &amp; mobile images are used as the banner's button text and background. Up to 10 most recently
                    published products in that collection show automatically underneath.
                  </p>
                )}
                {section.type === 'SHOP_BY_PRICE' && (
                  <>
                    <p className={sharedStyles.empty}>
                      Add one item per budget (4 looks best). Heading = the label written on the photo (e.g. &quot;Under
                      10k&quot;). Upload a square photo (about 800 × 800 px) and keep the bottom-left fairly plain — the label
                      goes there. Set where it opens with CTA URL (e.g. /products?priceMax=10000) or a category /
                      collection. The section heading is the title (e.g. &quot;Shop by Budget&quot;); the subtitle below is the
                      small grey line under it.
                    </p>
                    <CarouselSettings
                      section={section}
                      showButton={false}
                      onSave={(input) => updateSectionMutation.mutate({ id: section.id, input })}
                    />
                  </>
                )}
                {section.type === 'COLLECTION_CAROUSEL' && (
                  <>
                    <p className={sharedStyles.empty}>
                      Add 3 or more items — one per collection. Upload a square image (about 1000×1000) as "Banner image
                      — desktop"; put the collection name inside the artwork (nothing is written over it). Pick where
                      it opens with Link to Collection (or Category / CTA URL). Heading is only the image description
                      for Google and screen readers. The section heading above is the title (e.g. "Collections").
                    </p>
                    <CarouselSettings
                      section={section}
                      onSave={(input) => updateSectionMutation.mutate({ id: section.id, input })}
                    />
                  </>
                )}
                {section.type === 'IMAGE_MOSAIC' && (
                  <>
                    <p className={sharedStyles.empty}>
                      Add exactly 4 items, in this order: 1 = tall image on the left, 2 = middle top, 3 = middle
                      bottom, 4 = tall image on the right. Each item&apos;s Heading is shown as the caption under its
                      image (e.g. &quot;Gold Jewellery&quot;) — leave it empty for no caption. Pick where each image
                      opens with Link to Category / Collection / Product or CTA URL. The section heading above is the
                      title; add the line under it below.
                    </p>
                    <CarouselSettings
                      section={section}
                      showButton={false}
                      onSave={(input) => updateSectionMutation.mutate({ id: section.id, input })}
                    />
                  </>
                )}
                {section.type === 'PRICE_SHOWCASE' && (
                  <p className={sharedStyles.empty}>
                    Add one item per price band, in order (5 fill one row on desktop; phones swipe). Heading is the
                    price shown on the card — type it like &quot;Under ₹5,000&quot;, &quot;₹5,000 – ₹10,000&quot; or
                    &quot;Above ₹30,000&quot; and the card automatically opens all jewellery in that price range. Upload a
                    product photo (about 800×700) as &quot;Banner image — desktop&quot;. The section heading above is the
                    title; words after a comma show in gold (e.g. &quot;Beautiful Choices, Thoughtfully Priced&quot;).
                    CTA Label changes &quot;Shop Now&quot;; CTA URL or a Link overrides the price link.
                  </p>
                )}
                {section.type === 'VIDEO_STORY' && (
                  <>
                    <p className={sharedStyles.empty}>
                      Add 1 item and upload the video in it (MP4, landscape 16:9, under 50 MB — keep it short, 15–60
                      seconds is ideal, longer is fine). Visitors see the cover image with a play button and the video
                      plays with sound when clicked. Upload a cover image (a nice frame from the video). The item&apos;s
                      Subheading is the small gold line above the title (e.g. &quot;Our Manufacturing Process&quot;). The section heading above is the title (e.g.
                      &quot;Crafted in Our Studio&quot;); add the text and an optional button below.
                    </p>
                    <CarouselSettings
                      section={section}
                      onSave={(input) => updateSectionMutation.mutate({ id: section.id, input })}
                    />
                  </>
                )}
                {section.type === 'CATEGORY_STRIP' && (
                  <p className={sharedStyles.empty}>
                    Add ONE item per category you want to show, in the order you want them (drag to reorder). For each
                    item choose &quot;Link to Category&quot; and pick the category. The photo is optional: upload a square
                    600 × 600 px image, or leave it empty to use the category&apos;s own image. The name under the photo is
                    the category name — type a Heading to show a different label (e.g. &quot;Men&apos;s Special&quot;).
                    The section heading above is optional (leave it empty for no title).
                  </p>
                )}
                {section.type === 'FULL_WIDTH_BANNER' && (
                  <p className={sharedStyles.empty}>
                    Add ONE item. Upload the desktop image (1920 × 600 px) and the mobile image (1200 × 900 px) — the
                    banner runs edge to edge. Choose where it opens with Link to Collection / Category / Product or CTA
                    URL. Text is optional: if the artwork already has its wording, leave Heading, Subheading and CTA
                    Label empty. Otherwise Subheading = small label, Heading = big title, CTA Label = link text (on the left).
                  </p>
                )}
                {section.type === 'PRODUCT_ROW' && (
                  <>
                    <p className={sharedStyles.empty}>
                      Put the title in the section heading above (e.g. &quot;Everyday Studs&quot;) and the short description in
                      the subtitle below. Then add ONE item and choose &quot;Link to Category&quot; or &quot;Link to
                      Collection&quot; — up to 15 of its products show in one row (5 visible on desktop, arrows to scroll;
                      swipe on phones). No image is needed. A small &quot;View all&quot; link opens that category /
                      collection; to change its text, fill in the item&apos;s CTA Label.
                    </p>
                    <CarouselSettings
                      section={section}
                      showButton={false}
                      onSave={(input) => updateSectionMutation.mutate({ id: section.id, input })}
                    />
                  </>
                )}
                {section.type === 'PRODUCT_GRID' && (
                  <p className={sharedStyles.empty}>
                    Put the title in the section heading above (e.g. &quot;Everyday Earrings&quot;). Then add ONE item and
                    choose either &quot;Link to Category&quot; or &quot;Link to Collection&quot; — its products fill two rows
                    automatically (10 on desktop). No image is needed. The &quot;View All Products&quot; button opens that
                    category / collection; to change its text, fill in the item&apos;s CTA Label.
                  </p>
                )}
                {section.type === 'EDIT_BANNERS' && (
                  <p className={sharedStyles.empty}>
                    Add 2 items (one per banner) and choose a collection with &quot;Link to Collection&quot; — the banner
                    opens it. Upload a wide image (about 1400 × 860 px) with the jewellery or model on the right; the text
                    is written on the left. Subheading = the small label (e.g. &quot;THE EARRING EDIT&quot;), Heading = the big
                    title (e.g. &quot;A beautiful little twist.&quot;), CTA Label = the link text (default &quot;Discover more&quot;).
                    Text colour is automatic: banner 1 uses dark text (for a light image), banner 2 uses white text
                    (for a dark image). If your image already has the wording in it, leave Heading, Subheading and CTA
                    Label empty — then only the image is shown.
                  </p>
                )}
                {section.type === 'COLLECTION_SPOTLIGHT' && (
                  <p className={sharedStyles.empty}>
                    Add one item per collection and choose it with &quot;Link to Collection&quot; — the card opens that
                    collection. Upload a portrait image (about 800 × 960 px). The collection name is written on the card
                    in white at the bottom (or the item Heading, if you fill it in), with the Subheading as a short line
                    underneath (e.g. &quot;Delicate designs with a little sparkle&quot;) — so keep the bottom of the image fairly
                    plain and don&apos;t put the name in the artwork. The section Heading is the title above the cards.
                  </p>
                )}
                {section.type === 'PRODUCT_TABS' && (
                  <p className={sharedStyles.empty}>
                    Products fill in automatically: New Arrivals shows the 9 newest products; Bestsellers shows products
                    marked &quot;Best Seller&quot; on the Products page, then the most sold; Trending shows products marked
                    &quot;Trending&quot; on the Products page, then the most ordered / added to cart / wishlisted in the last 30 days. Trending
                    and Bestsellers appear only once they have at least 5 products. Add one item for the promo card next
                    to the products: upload a portrait image (about 600 × 1000 px), Subheading = the small line on top
                    (e.g. &quot;THE EVERYDAY EDIT&quot;), Heading = the title (e.g. &quot;Little luxuries. Every day.&quot;), CTA
                    Label = the button text (e.g. &quot;Explore now&quot;) and CTA URL or a Category / Collection link = where it
                    opens.
                  </p>
                )}
                {section.type === 'BANNER_TRIO' && (
                  <p className={sharedStyles.empty}>
                    Add exactly 3 items. Item 1 is the large square banner on the left (upload about 1200×1200); items 2
                    and 3 are the wide banners stacked on the right (about 1250×590 each). Put any text inside the
                    artwork itself — nothing is written over the images. Optionally add a separate "mobile" image for
                    phones. Heading is used only as the image description for Google and screen readers (e.g. "Shaya
                    silver collection"). Choose where each banner opens with Link to Category / Collection / Product or
                    CTA URL.
                  </p>
                )}
                {section.type === 'SHOP_BY_BOND' && (
                  <>
                    <p className={sharedStyles.empty}>
                      Same design as Shop by Budget. Add one item per card (e.g. Mother, Husband, Wife, Sister, Brother,
                      Friends) — up to 6 share one row on desktop, 3 per row on tablet, 2 on phones. Heading = the label
                      written on the photo. Upload a square photo (about 800 × 800 px) and keep the bottom-left fairly
                      plain. Pick where the card opens with &quot;Link to Collection&quot; (e.g. a &quot;Gifts for
                      Mother&quot; collection) or Category / CTA URL. The section heading is the title; the subtitle
                      below is the small grey line under it.
                    </p>
                    <CarouselSettings
                      section={section}
                      showButton={false}
                      onSave={(input) => updateSectionMutation.mutate({ id: section.id, input })}
                    />
                  </>
                )}
                {section.items.map((item, itemIndex) =>
                  editingItem?.id === item.id ? (
                    section.type === 'HERO' ? (
                      <HeroBannerForm
                        key={item.id}
                        initial={item}
                        onSubmit={(input) => updateItemMutation.mutateAsync({ id: item.id, input })}
                        onCancel={() => setEditingItem(null)}
                      />
                    ) : (
                      <HomepageItemForm
                        key={item.id}
                        sectionType={section.type}
                        initial={item}
                        onSubmit={(input) => updateItemMutation.mutateAsync({ id: item.id, input })}
                        onCancel={() => setEditingItem(null)}
                      />
                    )
                  ) : (
                    <div key={item.id} className={styles.itemRow}>
                      {imageForItem(item) ? (
                        <img src={imageForItem(item) as string} alt="" className={styles.itemThumb} />
                      ) : (
                        <span className={styles.itemThumbPlaceholder} />
                      )}
                      <div className={styles.moveButtons}>
                        <button type="button" onClick={() => moveItem(section, itemIndex, -1)} disabled={itemIndex === 0}>
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(section, itemIndex, 1)}
                          disabled={itemIndex === section.items.length - 1}
                        >
                          ↓
                        </button>
                      </div>
                      {section.type === 'HERO' ? (
                        <>
                          <span className={styles.itemHeading}>{item.name || '(unnamed banner)'}</span>
                          <span className={styles.itemMeta}>
                            <span className={item.isEnabled ? sharedStyles.badgeSuccess : sharedStyles.badgeNeutral}>
                              {item.isEnabled ? 'Enabled' : 'Disabled'}
                            </span>{' '}
                            {heroRedirectSummary(item)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={styles.itemHeading}>{item.heading ?? '(no heading)'}</span>
                          <span className={styles.itemMeta}>
                            {item.categoryId && 'Category'}
                            {item.collectionId && 'Collection'}
                            {item.productId && 'Product'}
                            {item.ctaUrl && `→ ${item.ctaUrl}`}
                          </span>
                        </>
                      )}
                      <div className={styles.itemActions}>
                        {section.type === 'COLLECTION_SHOWCASE' && item.collectionId && (
                          <button
                            type="button"
                            className={sharedStyles.buttonLink}
                            onClick={() => setOrderingCollectionId(item.collectionId)}
                          >
                            Manage First 50 Products
                          </button>
                        )}
                        <button type="button" className={sharedStyles.buttonLink} onClick={() => setEditingItem(item)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className={sharedStyles.buttonLink}
                          onClick={() => deleteItemMutation.mutate(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ),
                )}

                {addingItemTo === section.id ? (
                  section.type === 'HERO' ? (
                    <HeroBannerForm
                      onSubmit={(input) => createItemMutation.mutateAsync({ sectionId: section.id, input })}
                      onCancel={() => setAddingItemTo(null)}
                    />
                  ) : (
                    <HomepageItemForm
                      sectionType={section.type}
                      onSubmit={(input) => createItemMutation.mutateAsync({ sectionId: section.id, input })}
                      onCancel={() => setAddingItemTo(null)}
                    />
                  )
                ) : (
                  <button
                    type="button"
                    className={sharedStyles.button}
                    onClick={() => setAddingItemTo(section.id)}
                  >
                    {section.type === 'HERO' ? '+ Add Slide' : '+ Add Item'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {orderingCollectionId && (
        <FirstFiftyManager
          placementType="homepage_collection"
          placementId={orderingCollectionId}
          onClose={() => setOrderingCollectionId(null)}
        />
      )}

      {pendingDeleteSection && (
        <ConfirmDialog
          title="Delete section"
          message={`Delete the "${SECTION_TYPE_LABELS[pendingDeleteSection.type]}" section? This cannot be undone.`}
          isPending={deleteSectionMutation.isPending}
          onConfirm={() => deleteSectionMutation.mutate(pendingDeleteSection.id)}
          onCancel={() => setPendingDeleteSection(null)}
        />
      )}
    </div>
  );
}
