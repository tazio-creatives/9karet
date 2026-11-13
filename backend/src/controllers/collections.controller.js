import {
  createCollectionSchema,
  updateCollectionSchema,
} from '../validators/collections.validators.js';
import * as collectionsService from '../services/collectionsService.js';

function toDto(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: row.is_active,
  };
}

export async function list(req, res, next) {
  try {
    const collections = await collectionsService.listCollections({ activeOnly: true });
    res.json({ collections: collections.map(toDto) });
  } catch (err) {
    next(err);
  }
}

export async function getBySlug(req, res, next) {
  try {
    const collection = await collectionsService.getCollectionBySlugOrThrow(req.params.slug);
    res.json({ collection: toDto(collection) });
  } catch (err) {
    next(err);
  }
}

export async function adminList(req, res, next) {
  try {
    const collections = await collectionsService.listCollections({ activeOnly: false });
    res.json({ collections: collections.map(toDto) });
  } catch (err) {
    next(err);
  }
}

export async function adminCreate(req, res, next) {
  try {
    const input = createCollectionSchema.parse(req.body);
    const collection = await collectionsService.createCollection(input);
    res.status(201).json({ collection: toDto(collection) });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdate(req, res, next) {
  try {
    const input = updateCollectionSchema.parse(req.body);
    const collection = await collectionsService.updateCollection(req.params.id, input);
    res.json({ collection: toDto(collection) });
  } catch (err) {
    next(err);
  }
}

export async function adminDelete(req, res, next) {
  try {
    await collectionsService.deleteCollection(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
