import { slugify } from '../utils/slug.js';
import { NotFoundError } from '../utils/AppError.js';
import {
  listAllCollections,
  findCollectionBySlug,
  findCollectionById,
  createCollection as createCollectionRow,
  updateCollection as updateCollectionRow,
  deleteCollection as deleteCollectionRow,
} from '../repositories/collections.repository.js';
import { invalidateCollectionPages } from './pageCacheInvalidation.js';

export function listCollections(options) {
  return listAllCollections(options);
}

export async function getCollectionBySlugOrThrow(slug) {
  const collection = await findCollectionBySlug(slug);
  if (!collection) throw new NotFoundError('Collection not found');
  return collection;
}

export async function createCollection(input) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  const collection = await createCollectionRow({ ...input, slug });
  await invalidateCollectionPages(collection);
  return collection;
}

export async function updateCollection(id, input) {
  const existing = await findCollectionById(id);
  if (!existing) throw new NotFoundError('Collection not found');

  const fields = { ...input };
  if (Object.hasOwn(input, 'slug') && input.slug) {
    fields.slug = slugify(input.slug);
  }
  const collection = await updateCollectionRow(id, fields);
  await invalidateCollectionPages(collection, existing.slug);
  return collection;
}

export async function deleteCollection(id) {
  const existing = await findCollectionById(id);
  if (!existing) throw new NotFoundError('Collection not found');
  await deleteCollectionRow(id);
  await invalidateCollectionPages(existing);
}
