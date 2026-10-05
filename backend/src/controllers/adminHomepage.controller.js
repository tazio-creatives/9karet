import {
  createSectionSchema,
  updateSectionSchema,
  reorderSchema,
  createItemSchema,
  updateItemSchema,
} from '../validators/homepage.validators.js';
import {
  listAllSections,
  findSectionById,
  findMaxSectionSortOrder,
  insertSection,
  updateSection as updateSectionRow,
  deleteSection as deleteSectionRow,
  setSectionSortOrders,
  findItemsBySectionId,
  findItemById,
  findMaxItemSortOrder,
  insertItem,
  updateItem as updateItemRow,
  deleteItem as deleteItemRow,
  setItemSortOrders,
} from '../repositories/homepageAdmin.repository.js';
import { invalidatePageCache } from '../repositories/pageCache.repository.js';
import { processAndStoreHomepageImage } from '../services/homepageImageService.js';
import { findCategoryById } from '../repositories/categories.repository.js';
import { findCollectionById } from '../repositories/collections.repository.js';
import { findProductById } from '../repositories/products.repository.js';
import { AppError, NotFoundError } from '../utils/AppError.js';

const invalidateHome = () => invalidatePageCache(['/']);

function toSectionDto(section, items = []) {
  return {
    id: section.id,
    type: section.type,
    heading: section.heading,
    isEnabled: section.is_enabled,
    sortOrder: section.sort_order,
    items: items.map(toItemDto),
  };
}

function toItemDto(item) {
  return {
    id: item.id,
    imageUrl: item.image_url,
    imageUrlMobile: item.image_url_mobile,
    heading: item.heading,
    subheading: item.subheading,
    ctaLabel: item.cta_label,
    ctaUrl: item.cta_url,
    categoryId: item.category_id,
    collectionId: item.collection_id,
    productId: item.product_id,
    name: item.name,
    redirectType: item.redirect_type,
    openInNewTab: item.open_in_new_tab,
    isEnabled: item.is_enabled,
    sortOrder: item.sort_order,
  };
}

// Hero Banner-only cross-field rule: only the destination matching
// redirectType is meaningful, so the other two are force-cleared rather than
// trusted from the request body, and the chosen one must reference a real,
// currently-active/published row (point: "prevent saving invalid or deleted
// categories, collections or products"). Every other section type's item
// requests never send `redirectType`, so this is a no-op for them.
async function resolveHeroRedirect(input) {
  if (input.redirectType === undefined) return input;
  const result = { ...input };

  if (result.redirectType === 'NONE') {
    result.categoryId = null;
    result.collectionId = null;
    result.productId = null;
    return result;
  }

  if (result.redirectType === 'CATEGORY') {
    result.collectionId = null;
    result.productId = null;
    if (!result.categoryId) throw new AppError(400, 'Select a category for the redirect destination.');
    const category = await findCategoryById(result.categoryId);
    if (!category || !category.is_active) {
      throw new AppError(400, 'Selected category is invalid, inactive, or has been deleted.');
    }
  } else if (result.redirectType === 'COLLECTION') {
    result.categoryId = null;
    result.productId = null;
    if (!result.collectionId) throw new AppError(400, 'Select a collection for the redirect destination.');
    const collection = await findCollectionById(result.collectionId);
    if (!collection || !collection.is_active) {
      throw new AppError(400, 'Selected collection is invalid, inactive, or has been deleted.');
    }
  } else if (result.redirectType === 'PRODUCT') {
    result.categoryId = null;
    result.collectionId = null;
    if (!result.productId) throw new AppError(400, 'Select a product for the redirect destination.');
    const product = await findProductById(result.productId);
    if (!product || product.status !== 'PUBLISHED') {
      throw new AppError(400, 'Selected product is invalid, unpublished, or has been deleted.');
    }
  }

  return result;
}

export async function list(req, res, next) {
  try {
    const sections = await listAllSections();
    const withItems = await Promise.all(
      sections.map(async (section) => toSectionDto(section, await findItemsBySectionId(section.id))),
    );
    res.json({ sections: withItems });
  } catch (err) {
    next(err);
  }
}

export async function createSection(req, res, next) {
  try {
    const input = createSectionSchema.parse(req.body);
    const sortOrder = (await findMaxSectionSortOrder()) + 1;
    const section = await insertSection({ ...input, sortOrder });
    await invalidateHome();
    res.status(201).json({ section: toSectionDto(section) });
  } catch (err) {
    next(err);
  }
}

export async function updateSection(req, res, next) {
  try {
    const input = updateSectionSchema.parse(req.body);
    const existing = await findSectionById(req.params.id);
    if (!existing) throw new NotFoundError('Section not found');
    const section = await updateSectionRow(req.params.id, input);
    const items = await findItemsBySectionId(section.id);
    await invalidateHome();
    res.json({ section: toSectionDto(section, items) });
  } catch (err) {
    next(err);
  }
}

export async function deleteSection(req, res, next) {
  try {
    const existing = await findSectionById(req.params.id);
    if (!existing) throw new NotFoundError('Section not found');
    await deleteSectionRow(req.params.id);
    await invalidateHome();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// A reorder must list every current row exactly once — a stale admin tab
// (someone else added/deleted a section meanwhile) gets a clear error
// instead of a half-applied order.
function assertSameIds(order, rows, label) {
  const current = new Set(rows.map((r) => r.id));
  if (order.length !== current.size || new Set(order).size !== order.length || !order.every((id) => current.has(id))) {
    throw new AppError(409, `The homepage ${label} changed since this page loaded — refresh and try again.`);
  }
}

export async function reorderSections(req, res, next) {
  try {
    const { order } = reorderSchema.parse(req.body);
    const existing = await listAllSections();
    assertSameIds(order, existing, 'sections');
    await setSectionSortOrders(order);
    await invalidateHome();
    const sections = await listAllSections();
    res.json({ sections: sections.map((s) => toSectionDto(s)) });
  } catch (err) {
    next(err);
  }
}

export async function uploadImage(req, res, next) {
  try {
    if (!req.file) throw new AppError(400, 'No image file provided');
    const { url } = await processAndStoreHomepageImage(req.file.buffer);
    res.status(201).json({ url });
  } catch (err) {
    next(err);
  }
}

export async function createItem(req, res, next) {
  try {
    const sectionId = req.params.id;
    const section = await findSectionById(sectionId);
    if (!section) throw new NotFoundError('Section not found');

    const input = await resolveHeroRedirect(createItemSchema.parse(req.body));
    const sortOrder = (await findMaxItemSortOrder(sectionId)) + 1;
    const item = await insertItem({ ...input, sectionId, sortOrder });
    await invalidateHome();
    res.status(201).json({ item: toItemDto(item) });
  } catch (err) {
    next(err);
  }
}

export async function updateItem(req, res, next) {
  try {
    const existing = await findItemById(req.params.id);
    if (!existing) throw new NotFoundError('Item not found');
    const input = await resolveHeroRedirect(updateItemSchema.parse(req.body));
    const item = await updateItemRow(req.params.id, input);
    await invalidateHome();
    res.json({ item: toItemDto(item) });
  } catch (err) {
    next(err);
  }
}

export async function deleteItem(req, res, next) {
  try {
    const existing = await findItemById(req.params.id);
    if (!existing) throw new NotFoundError('Item not found');
    await deleteItemRow(req.params.id);
    await invalidateHome();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function reorderItems(req, res, next) {
  try {
    const sectionId = req.params.id;
    const section = await findSectionById(sectionId);
    if (!section) throw new NotFoundError('Section not found');

    const { order } = reorderSchema.parse(req.body);
    assertSameIds(order, await findItemsBySectionId(sectionId), 'items');
    await setItemSortOrders(sectionId, order);
    await invalidateHome();
    const items = await findItemsBySectionId(sectionId);
    res.json({ items: items.map(toItemDto) });
  } catch (err) {
    next(err);
  }
}
