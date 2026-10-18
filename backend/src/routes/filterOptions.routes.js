import { Router } from 'express';
import { findAllAttributesWithGlobalValues } from '../repositories/attributes.repository.js';

// Mounted at /api/v1/filter-options — public. The storefront's product-list
// filters show only values that are switched on in Admin → Attributes (an
// attribute or value deactivated there disappears from the filter).
export const filterOptionsRouter = Router();

function activeValues(attributes, code) {
  const attr = attributes.find((a) => a.code === code);
  if (!attr || !attr.isActive) return [];
  return attr.values.filter((v) => v.isActive).map((v) => ({ value: v.value, label: v.label }));
}

filterOptionsRouter.get('/', async (req, res, next) => {
  try {
    const attributes = await findAllAttributesWithGlobalValues();
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ goldColors: activeValues(attributes, 'gold_color'), purities: activeValues(attributes, 'purity') });
  } catch (err) {
    next(err);
  }
});
