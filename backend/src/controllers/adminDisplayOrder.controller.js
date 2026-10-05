import { withTransaction } from '../config/db.js';
import {
  placementParamsSchema,
  saveDisplayOrderSchema,
  searchPlacementProductsSchema,
  MAX_DISPLAY_ORDER_PRODUCTS,
} from '../validators/displayOrder.validators.js';
import { findDisplayOrder, replaceDisplayOrder, deleteDisplayOrder } from '../repositories/productDisplayOrder.repository.js';
import { findProductsByIds, listProducts } from '../repositories/products.repository.js';
import { findCategoryById, getCategoryAndDescendantIds } from '../repositories/categories.repository.js';
import { findCollectionById } from '../repositories/collections.repository.js';
import { insertAuditLog } from '../repositories/auditLogs.repository.js';
import { invalidatePageCache, invalidatePageCacheByPrefix } from '../repositories/pageCache.repository.js';
import { NotFoundError } from '../utils/AppError.js';

// Admin "Manage First 50 Products" for a homepage collection showcase or a
// category page. The storefront side is products.repository.js#listProducts.

async function resolvePlacement(params) {
  const { placementType, placementId } = placementParamsSchema.parse(params);
  if (placementType === 'category') {
    const category = await findCategoryById(placementId);
    if (!category) throw new NotFoundError('Category not found');
    // A category page lists its subcategories' products too.
    const categoryIds = await getCategoryAndDescendantIds(category.id);
    return { type: placementType, id: placementId, name: category.name, slug: category.slug, categoryIds };
  }
  const collection = await findCollectionById(placementId);
  if (!collection) throw new NotFoundError('Collection not found');
  return { type: placementType, id: placementId, name: collection.name, slug: collection.slug };
}

function belongsToPlacement(row, placement) {
  return placement.type === 'category'
    ? placement.categoryIds.includes(row.category_id)
    : row.collection_id === placement.id;
}

function productDto(row) {
  return {
    productId: row.id,
    name: row.name,
    sku: row.sku,
    imageUrl: row.primary_image_url ?? null,
    sellingPrice: Number(row.selling_price ?? 0),
    availableStock: row.available_stock ?? 0,
    status: row.status,
  };
}

// Why a saved product is skipped on the storefront (or, for stock, just a
// heads-up — out-of-stock products keep the site's existing behaviour).
function warningsFor(row, placement) {
  if (!row) return ['Deleted product'];
  const warnings = [];
  if (row.status === 'DRAFT') warnings.push('Unpublished');
  else if (row.status !== 'PUBLISHED') warnings.push('Inactive');
  if (!belongsToPlacement(row, placement)) {
    warnings.push(placement.type === 'category' ? 'Out of category' : 'Out of collection');
  }
  if (!(Number(row.selling_price) > 0)) warnings.push('Invalid price');
  if ((row.available_stock ?? 0) <= 0) warnings.push('Out of stock');
  return warnings;
}

async function loadOrder(placement) {
  const saved = await findDisplayOrder(placement.type, placement.id);
  const products = await findProductsByIds(saved.map((s) => s.product_id));
  const byId = new Map(products.map((p) => [p.id, p]));
  return saved.map((s) => {
    const row = byId.get(s.product_id) ?? null;
    const warnings = warningsFor(row, placement);
    return {
      position: s.position,
      ...(row ? productDto(row) : { productId: s.product_id, name: null, sku: null, imageUrl: null, sellingPrice: 0, availableStock: 0, status: null }),
      warnings,
      // Out of stock alone doesn't stop it showing on the storefront.
      isHidden: warnings.some((w) => w !== 'Out of stock'),
    };
  });
}

function placementDto(placement) {
  return { type: placement.type, id: placement.id, name: placement.name, slug: placement.slug };
}

async function invalidatePlacementPages(placement) {
  if (placement.type === 'homepage_collection') await invalidatePageCache(['/']);
  else await invalidatePageCacheByPrefix(`/${placement.slug}`);
}

export async function get(req, res, next) {
  try {
    const placement = await resolvePlacement(req.params);
    res.json({ placement: placementDto(placement), items: await loadOrder(placement), maxProducts: MAX_DISPLAY_ORDER_PRODUCTS });
  } catch (err) {
    next(err);
  }
}

// Server-side, paginated search limited to products that can actually show
// in this placement (published, priced, in the category/collection).
export async function searchProducts(req, res, next) {
  try {
    const placement = await resolvePlacement(req.params);
    const { search, page = 1, limit = 20 } = searchPlacementProductsSchema.parse(req.query);
    const filters = {
      status: 'PUBLISHED',
      excludeZeroPrice: true,
      search: search || undefined,
      ...(placement.type === 'category' ? { categoryIds: placement.categoryIds } : { collectionId: placement.id }),
    };
    const { items, total } = await listProducts(filters, { sort: 'newest', page, limit });
    res.json({ products: items.map(productDto), page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function save(req, res, next) {
  try {
    const placement = await resolvePlacement(req.params);
    const { productIds } = saveDisplayOrderSchema.parse(req.body);
    const previous = await findDisplayOrder(placement.type, placement.id);

    await withTransaction(() => replaceDisplayOrder(placement.type, placement.id, productIds));
    await insertAuditLog({
      adminUserId: req.admin.id,
      action: 'PUT',
      entity: 'display-order',
      entityId: placement.id,
      diff: {
        placementType: placement.type,
        placementName: placement.name,
        previousOrder: previous.map((p) => p.product_id),
        newOrder: productIds,
      },
    });
    await invalidatePlacementPages(placement);

    res.json({ placement: placementDto(placement), items: await loadOrder(placement), maxProducts: MAX_DISPLAY_ORDER_PRODUCTS });
  } catch (err) {
    next(err);
  }
}

// Removes only the saved order — products themselves are untouched and the
// storefront falls back to its default order.
export async function reset(req, res, next) {
  try {
    const placement = await resolvePlacement(req.params);
    const previous = await findDisplayOrder(placement.type, placement.id);
    await deleteDisplayOrder(placement.type, placement.id);
    await insertAuditLog({
      adminUserId: req.admin.id,
      action: 'DELETE',
      entity: 'display-order',
      entityId: placement.id,
      diff: {
        placementType: placement.type,
        placementName: placement.name,
        previousOrder: previous.map((p) => p.product_id),
        newOrder: [],
      },
    });
    await invalidatePlacementPages(placement);
    res.json({ placement: placementDto(placement), items: [], maxProducts: MAX_DISPLAY_ORDER_PRODUCTS });
  } catch (err) {
    next(err);
  }
}
