import { query } from '../config/db.js';
import { getCategoryAndDescendantIds } from './categories.repository.js';
import { listProducts } from './products.repository.js';

export async function getEnabledSectionsWithItems() {
  const { rows: sections } = await query(
    `SELECT id, type, heading, subheading, cta_label, cta_url, sort_order FROM homepage_sections
     WHERE is_enabled = true ORDER BY sort_order, created_at`,
  );
  if (sections.length === 0) return [];

  const sectionIds = sections.map((s) => s.id);
  const { rows: items } = await query(
    `SELECT
       hi.id, hi.section_id, hi.image_url, hi.image_url_mobile, hi.video_url, hi.heading, hi.subheading, hi.cta_label, hi.cta_url, hi.sort_order,
       hi.name, hi.redirect_type, hi.open_in_new_tab,
       c.id AS category_id, c.name AS category_name, c.slug AS category_slug, c.image_url AS category_image_url,
       c.is_active AS category_is_active,
       col.id AS collection_id, col.name AS collection_name, col.slug AS collection_slug,
       col.is_active AS collection_is_active,
       p.id AS product_id, p.name AS product_name, p.slug AS product_slug, p.status AS product_status,
       p_cat.slug AS product_category_slug,
       p.selling_price AS product_selling_price, p.metal_type AS product_metal_type,
       p.purity AS product_purity, p_image.url AS product_image_url,
       p.mrp AS product_mrp, p.gold_value AS product_gold_value, p.diamond_value AS product_diamond_value,
       p.making_charge AS product_making_charge, p.gst_percent AS product_gst_percent,
       p.making_charge_discount_percent AS product_making_charge_discount_percent,
       p.diamond_discount_percent AS product_diamond_discount_percent,
       p.effective_making_charge_discount_percent AS product_effective_making_charge_discount_percent,
       p.effective_diamond_discount_percent AS product_effective_diamond_discount_percent
     FROM homepage_items hi
     LEFT JOIN categories c ON c.id = hi.category_id
     LEFT JOIN collections col ON col.id = hi.collection_id
     LEFT JOIN products p ON p.id = hi.product_id
     LEFT JOIN categories p_cat ON p_cat.id = p.category_id
     LEFT JOIN LATERAL (
       SELECT url FROM product_images
       WHERE product_id = p.id AND is_primary = true AND variant = 'small'
       LIMIT 1
     ) p_image ON true
     WHERE hi.section_id = ANY($1) AND hi.is_enabled = true
     ORDER BY hi.section_id, hi.sort_order, hi.created_at`,
    [sectionIds],
  );

  const itemsBySection = new Map();
  for (const item of items) {
    if (!itemsBySection.has(item.section_id)) itemsBySection.set(item.section_id, []);
    itemsBySection.get(item.section_id).push(item);
  }

  // BENTO_CATEGORIES tiles are auto-derived from the categories table
  // (every active top-level category becomes a tile) rather than manually
  // curated per homepage_item — admins manage a category's name/image once,
  // on the category itself, instead of duplicating it into a homepage item
  // too every time a category is added. Any homepage_items rows still
  // stored against this section type are ignored on read.
  const bentoCategorySections = sections.filter((s) => s.type === 'BENTO_CATEGORIES');
  if (bentoCategorySections.length > 0) {
    const { rows: topLevelCategories } = await query(
      `SELECT id, name, slug, image_url FROM categories
       WHERE parent_id IS NULL AND is_active = true
       ORDER BY sort_order, name`,
    );
    const autoItems = topLevelCategories.map((c) => ({
      id: c.id,
      image_url: null,
      image_url_mobile: null,
      heading: c.name,
      subheading: null,
      cta_label: `Shop ${c.name}`,
      cta_url: null,
      category_id: c.id,
      category_name: c.name,
      category_slug: c.slug,
      category_image_url: c.image_url,
      collection_id: null,
      collection_name: null,
      collection_slug: null,
      product_id: null,
      product_name: null,
      product_slug: null,
      product_selling_price: null,
    }));
    for (const section of bentoCategorySections) {
      itemsBySection.set(section.id, autoItems);
    }
  }

  // NEW_ARRIVALS keeps the "one item, many products" shape used by
  // COLLECTION_SHOWCASE below — the item carries the admin-editable banner
  // (image/heading/subheading, via the ordinary "+ Add Item" form; only the
  // first item renders), while its `products` array is always auto-derived
  // (most recently published products, newest first) so the storefront's
  // product-card component and pricing DTO can be reused as-is instead of
  // hand-rolled offer math. If no admin item exists yet, a blank synthetic
  // one stands in so the section still renders (frontend falls back to
  // default banner copy/art for a null image_url/heading/subheading).
  const newArrivalsSections = sections.filter((s) => s.type === 'NEW_ARRIVALS');
  if (newArrivalsSections.length > 0) {
    const { items: recentProducts } = await listProducts(
      { status: 'PUBLISHED' },
      { sort: 'newest', page: 1, limit: 10 },
    );
    for (const section of newArrivalsSections) {
      const sectionItems = itemsBySection.get(section.id) ?? [];
      const bannerItem = sectionItems[0] ?? {
        id: 'new-arrivals',
        image_url: null,
        image_url_mobile: null,
        heading: null,
        subheading: null,
        cta_label: null,
        cta_url: null,
        category_id: null,
        category_name: null,
        category_slug: null,
        category_image_url: null,
        collection_id: null,
        collection_name: null,
        collection_slug: null,
        product_id: null,
        product_name: null,
        product_slug: null,
        product_selling_price: null,
      };
      bannerItem.products = recentProducts;
      itemsBySection.set(section.id, [bannerItem]);
    }
  }

  // FEATURED_PRODUCT is likewise auto-derived — whichever product(s) an
  // admin has flagged is_featured on the product itself (Products list),
  // most recently updated first — rather than manually attached via
  // homepage_items. Same reasoning as BENTO_CATEGORIES/NEW_ARRIVALS above.
  const featuredProductSections = sections.filter((s) => s.type === 'FEATURED_PRODUCT');
  if (featuredProductSections.length > 0) {
    const { rows: featuredProducts } = await query(
      `SELECT p.id, p.name, p.slug, p.selling_price, p.metal_type, p.purity,
              p.mrp, p.gold_value, p.diamond_value, p.making_charge, p.gst_percent,
              p.making_charge_discount_percent, p.diamond_discount_percent,
              p.effective_making_charge_discount_percent, p.effective_diamond_discount_percent,
              cat.slug AS category_slug, p_image.url AS product_image_url
       FROM products p
       LEFT JOIN categories cat ON cat.id = p.category_id
       LEFT JOIN LATERAL (
         SELECT url FROM product_images
         WHERE product_id = p.id AND is_primary = true AND variant = 'small'
         LIMIT 1
       ) p_image ON true
       WHERE p.status = 'PUBLISHED' AND p.is_featured = true
       ORDER BY p.updated_at DESC
       LIMIT 8`,
    );
    const autoItems = featuredProducts.map((p) => ({
      id: p.id,
      image_url: null,
      image_url_mobile: null,
      heading: p.name,
      subheading: null,
      cta_label: null,
      cta_url: p.category_slug ? `/${p.category_slug}/${p.slug}` : `/${p.slug}`,
      category_id: null,
      category_name: null,
      category_slug: null,
      category_image_url: null,
      collection_id: null,
      collection_name: null,
      collection_slug: null,
      product_id: p.id,
      product_name: p.name,
      product_slug: p.slug,
      product_selling_price: p.selling_price,
      product_metal_type: p.metal_type,
      product_purity: p.purity,
      product_image_url: p.product_image_url,
      product_mrp: p.mrp,
      product_gold_value: p.gold_value,
      product_diamond_value: p.diamond_value,
      product_making_charge: p.making_charge,
      product_gst_percent: p.gst_percent,
      product_making_charge_discount_percent: p.making_charge_discount_percent,
      product_diamond_discount_percent: p.diamond_discount_percent,
      product_effective_making_charge_discount_percent: p.effective_making_charge_discount_percent,
      product_effective_diamond_discount_percent: p.effective_diamond_discount_percent,
    }));
    for (const section of featuredProductSections) {
      itemsBySection.set(section.id, autoItems);
    }
  }

  // CATEGORY_PRODUCTS items stay manually curated (an admin links each item
  // to a category via the ordinary "Link to Category" picker), but the
  // products under that category are auto-derived — same "pick the category,
  // let the products follow" split used by BENTO_CATEGORIES/NEW_ARRIVALS
  // above, just scoped per-item instead of per-section. Reuses the same
  // category-descendant resolution and product listing the public PLP uses,
  // rather than duplicating that query here.
  const categoryProductsSections = sections.filter((s) => s.type === 'CATEGORY_PRODUCTS');
  for (const section of categoryProductsSections) {
    const sectionItems = itemsBySection.get(section.id) ?? [];
    for (const item of sectionItems) {
      if (!item.category_id) {
        item.products = [];
        continue;
      }
      const categoryIds = await getCategoryAndDescendantIds(item.category_id);
      const { items: products } = await listProducts(
        { categoryIds, status: 'PUBLISHED' },
        { sort: 'newest', page: 1, limit: 5 },
      );
      item.products = products;
    }
  }

  // COLLECTION_SHOWCASE mirrors CATEGORY_PRODUCTS' "pick the link, let the
  // products follow" split, just keyed on collection_id and capped at 15
  // (3 rows of 5 on desktop; mobile shows only the first 8 of it via CSS)
  // instead of 5. Only the section's first item is meant to be rendered as
  // the one banner (CollectionProductShowcase.tsx enforces that) — any
  // extra items an admin adds are still synced here for consistency but the
  // frontend ignores them.
  const collectionShowcaseSections = sections.filter((s) => s.type === 'COLLECTION_SHOWCASE');
  for (const section of collectionShowcaseSections) {
    const sectionItems = itemsBySection.get(section.id) ?? [];
    for (const item of sectionItems) {
      if (!item.collection_id) {
        item.products = [];
        continue;
      }
      // limit matches CollectionProductShowcase.tsx's own fixed batch size
      // (useFixedProducts' LIMIT) — the frontend shows this SSR-embedded
      // batch immediately and only re-fetches client-side as a top-up if it
      // ever arrives smaller than that, so keeping this in lockstep avoids
      // an always-on extra round trip on every homepage load.
      // Same filters/order as the client top-up fetch (placement=homepage):
      // admin's "First 50" order for this collection first, ₹0 products never.
      const { items: products } = await listProducts(
        { collectionId: item.collection_id, status: 'PUBLISHED', excludeZeroPrice: true },
        {
          sort: 'featured',
          page: 1,
          limit: 15,
          placement: { type: 'homepage_collection', id: item.collection_id },
        },
      );
      item.products = products;
    }
  }

  return sections.map((section) => ({
    ...section,
    items: itemsBySection.get(section.id) ?? [],
  }));
}
