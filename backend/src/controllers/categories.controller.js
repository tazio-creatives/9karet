import { createCategorySchema, updateCategorySchema } from '../validators/categories.validators.js';
import * as categoriesService from '../services/categoriesService.js';
import { processAndStoreCategoryImage } from '../services/homepageImageService.js';
import { getCategoryAndDescendantIds } from '../repositories/categories.repository.js';
import { countPublishedProducts } from '../repositories/products.repository.js';
import { AppError } from '../utils/AppError.js';

function toDto(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    banner: row.banner_enabled
      ? {
          eyebrow: row.banner_eyebrow,
          description: row.banner_description,
          imageUrl: row.banner_image_url,
          imageUrlMobile: row.banner_image_url_mobile,
          altText: row.banner_alt_text,
          textColor: row.banner_text_color,
          textPosition: row.banner_text_position,
          focalPosition: row.banner_focal_position,
        }
      : null,
  };
}

// Admin form needs the raw fields (including when disabled/blank) to
// populate its edit inputs — the public toDto above collapses a disabled
// banner to `null` so storefront callers never have to check an `enabled`
// flag themselves.
function toAdminDto(row) {
  return {
    ...toDto(row),
    isNonReturnable: row.is_non_returnable ?? false,
    banner: {
      enabled: row.banner_enabled,
      eyebrow: row.banner_eyebrow,
      description: row.banner_description,
      imageUrl: row.banner_image_url,
      imageUrlMobile: row.banner_image_url_mobile,
      altText: row.banner_alt_text,
      textColor: row.banner_text_color,
      textPosition: row.banner_text_position,
      focalPosition: row.banner_focal_position,
    },
  };
}

export async function list(req, res, next) {
  try {
    const categories = await categoriesService.listCategories({ activeOnly: true });
    res.json({ categories: categories.map(toDto) });
  } catch (err) {
    next(err);
  }
}

export async function getBySlug(req, res, next) {
  try {
    const category = await categoriesService.getCategoryBySlugOrThrow(req.params.slug);
    res.json({ category: toDto(category) });
  } catch (err) {
    next(err);
  }
}

// PLP sidebar "Category" filter counts — descendant-inclusive published
// product counts for the current category ("All {name}") and each of its
// direct children, reusing getCategoryAndDescendantIds so a count stays
// correct even if a child later grows its own subcategories.
export async function getFilterCounts(req, res, next) {
  try {
    const category = await categoriesService.getCategoryBySlugOrThrow(req.params.slug);
    const allCategories = await categoriesService.listCategories({ activeOnly: true });
    const children = allCategories.filter((c) => c.parent_id === category.id);

    const totalIds = await getCategoryAndDescendantIds(category.id);
    const total = await countPublishedProducts(totalIds);

    const subcategories = await Promise.all(
      children.map(async (child) => {
        const ids = await getCategoryAndDescendantIds(child.id);
        return { id: child.id, name: child.name, slug: child.slug, count: await countPublishedProducts(ids) };
      }),
    );

    res.json({ total, subcategories });
  } catch (err) {
    next(err);
  }
}

export async function adminList(req, res, next) {
  try {
    const categories = await categoriesService.listCategories({ activeOnly: false });
    res.json({ categories: categories.map(toAdminDto) });
  } catch (err) {
    next(err);
  }
}

export async function adminCreate(req, res, next) {
  try {
    const input = createCategorySchema.parse(req.body);
    const category = await categoriesService.createCategory(input);
    res.status(201).json({ category: toAdminDto(category) });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdate(req, res, next) {
  try {
    const input = updateCategorySchema.parse(req.body);
    const category = await categoriesService.updateCategory(req.params.id, input);
    res.json({ category: toAdminDto(category) });
  } catch (err) {
    next(err);
  }
}

export async function adminDelete(req, res, next) {
  try {
    await categoriesService.deleteCategory(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function adminUploadImage(req, res, next) {
  try {
    if (!req.file) throw new AppError(400, 'No image file provided');
    const { url } = await processAndStoreCategoryImage(req.file.buffer);
    res.status(201).json({ url });
  } catch (err) {
    next(err);
  }
}
