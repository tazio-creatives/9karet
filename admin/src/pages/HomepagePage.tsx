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
import type { HomepageItem, HomepageItemInput, HomepageSection, HomepageSectionType } from '../api/types';
import { HomepageItemForm } from '../features/homepage/HomepageItemForm';
import { HeroBannerForm } from '../features/homepage/HeroBannerForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FirstFiftyManager } from '../features/displayOrder/FirstFiftyManager';
import sharedStyles from '../styles/shared.module.css';
import styles from './HomepagePage.module.css';

// Section types whose tiles are auto-derived server-side (from categories /
// products tables) rather than manually curated per homepage_item — see
// homepage.repository.js's getEnabledSectionsWithItems. Keep in sync with
// that file's special-cased section types.
const AUTO_SYNCED_TYPES: HomepageSectionType[] = ['BENTO_CATEGORIES', 'FEATURED_PRODUCT'];

const SECTION_TYPES: HomepageSectionType[] = [
  'HERO',
  'BENTO_CATEGORIES',
  'NEW_ARRIVALS',
  'COLLECTION_CARDS',
  'SHOP_BY_MATERIAL',
  'FEATURED_PRODUCT',
  'BEST_SELLERS',
  'SHOP_BY_PRICE',
  'OCCASION_CARDS',
  'INSTAGRAM',
  'NEWSLETTER',
  'TRUST_STRIP',
  'CAMPAIGN_BANNERS',
  'CATEGORY_PRODUCTS',
  'COLLECTION_SHOWCASE',
  'SHOP_BY_BOND',
];

// Friendly names matching the actual storefront headings — the raw type
// name (e.g. "OCCASION CARDS") doesn't read as "Shop by Occasion", which
// made the option hard to find by eye in the Add Section dropdown.
const SECTION_TYPE_LABELS: Record<HomepageSectionType, string> = {
  HERO: 'Hero Banner',
  BENTO_CATEGORIES: 'Shop by Category',
  NEW_ARRIVALS: 'New Arrivals',
  COLLECTION_CARDS: 'Curated Collections',
  SHOP_BY_MATERIAL: 'Shop by Material',
  FEATURED_PRODUCT: 'Featured Products',
  BEST_SELLERS: 'Best Sellers',
  SHOP_BY_PRICE: 'Shop by Price',
  OCCASION_CARDS: 'Shop by Occasion',
  INSTAGRAM: 'Instagram Feed',
  NEWSLETTER: 'Newsletter',
  TRUST_STRIP: 'Trust Strip',
  CAMPAIGN_BANNERS: 'Campaign Banners',
  CATEGORY_PRODUCTS: 'Category Products',
  COLLECTION_SHOWCASE: 'Full Width Banner with Products',
  SHOP_BY_BOND: 'Shop by Bond',
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

// This is the only per-section label that's admin-only — every other
// "Heading"/"Subheading" field further down (inside Edit Item / Add Item)
// is real storefront content. An unlabeled input with just a placeholder
// wasn't distinct enough from those to make that clear, so it gets an
// explicit caption rather than relying on the placeholder alone (which
// disappears once something's typed).
function SectionHeadingInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <div>
      <input
        className={styles.headingInput}
        value={draft}
        placeholder="Admin label"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
      />
      <span className={styles.headingHint}>Admin-only — not shown on the storefront</span>
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
    mutationFn: ({ id, input }: { id: string; input: { heading?: string | null; isEnabled?: boolean } }) =>
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
                    Each item below is one slide. The uploaded image already contains its own heading, description
                    and call-to-action artwork — nothing is overlaid on top of it. Choose what the whole banner links
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
                {section.type === 'SHOP_BY_BOND' && (
                  <p className={sharedStyles.empty}>
                    Add one item per tile (e.g. Mother, Husband, Wife, Sister, Brother, Friends) — six fill one row on
                    desktop and two rows of three on mobile. Heading is the label under the photo. Upload a portrait
                    photo (about 3:4, e.g. 600×800) as "Banner image — desktop", and pick where the tile opens with
                    "Link to Collection" (e.g. a "Gifts for Mother" collection) or Category / CTA URL. The section
                    heading above (e.g. "Shop by Bond") is shown as the title on the storefront.
                  </p>
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
                    {section.type === 'HERO' ? '+ Add Banner' : '+ Add Item'}
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
