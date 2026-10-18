import {
  createAttributeSchema,
  updateAttributeSchema,
  createAttributeValueSchema,
  updateAttributeValueSchema,
} from '../validators/attributes.validators.js';
import {
  findAllAttributesWithGlobalValues,
  createAttribute,
  updateAttribute,
  createGlobalAttributeValue,
  updateAttributeValue,
} from '../repositories/attributes.repository.js';
import { AppError } from '../utils/AppError.js';

function toDto(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    values: row.values.map((v) => ({
      id: v.id,
      value: v.value,
      label: v.label,
      refId: v.refId,
      sortOrder: v.sortOrder,
      isActive: v.isActive,
    })),
  };
}

// Every attribute type + its shared/global values (Purity, Gold Color, and
// any future type added here) — the one place an admin can introduce a genuinely new variation axis without a developer
// running a migration. Size is deliberately excluded (product-scoped
// values, managed from the product form itself).
export async function list(req, res, next) {
  try {
    const rows = await findAllAttributesWithGlobalValues();
    res.json({ attributes: rows.map(toDto) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const input = createAttributeSchema.parse(req.body);
    const id = await createAttribute(input);
    res.status(201).json({ id });
  } catch (err) {
    if (err.code === '23505') return next(new AppError(409, 'An attribute with this code already exists.'));
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const input = updateAttributeSchema.parse(req.body);
    await updateAttribute(req.params.id, input);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function createValue(req, res, next) {
  try {
    const input = createAttributeValueSchema.parse(req.body);
    const id = await createGlobalAttributeValue(req.params.id, input);
    res.status(201).json({ id });
  } catch (err) {
    if (err.code === '23505') return next(new AppError(409, 'This value already exists for this attribute.'));
    next(err);
  }
}

export async function updateValue(req, res, next) {
  try {
    const input = updateAttributeValueSchema.parse(req.body);
    await updateAttributeValue(req.params.valueId, input);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
