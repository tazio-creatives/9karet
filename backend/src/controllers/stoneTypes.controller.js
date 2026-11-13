import { createStoneTypeSchema, updateStoneTypeSchema } from '../validators/stoneTypes.validators.js';
import {
  listStoneTypes,
  findStoneTypeById,
  createStoneType,
  updateStoneType,
} from '../repositories/stoneTypes.repository.js';
import { NotFoundError, AppError } from '../utils/AppError.js';

// No delete endpoint — stone_types is FK-referenced (ON DELETE RESTRICT)
// from both product_stones and pricing_rule_stone_types, so a type that's
// ever been used can't be cleanly removed; deactivating (isActive: false)
// is the supported way to retire one.
function toDto(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function list(req, res, next) {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const rows = await listStoneTypes({ activeOnly });
    res.json({ stoneTypes: rows.map(toDto) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const input = createStoneTypeSchema.parse(req.body);
    const row = await createStoneType(input);
    res.status(201).json({ stoneType: toDto(row) });
  } catch (err) {
    if (err.code === '23505') return next(new AppError(409, 'A stone type with this name already exists.'));
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const input = updateStoneTypeSchema.parse(req.body);
    const existing = await findStoneTypeById(req.params.id);
    if (!existing) throw new NotFoundError('Stone type not found');
    const row = await updateStoneType(req.params.id, input);
    res.json({ stoneType: toDto(row) });
  } catch (err) {
    if (err.code === '23505') return next(new AppError(409, 'A stone type with this name already exists.'));
    next(err);
  }
}
