import { listProductOverridesQuerySchema, bulkOverrideActionSchema } from '../validators/productOverrides.validators.js';
import { listProductOverrides, applyBulkOverrideAction } from '../services/productOverridesService.js';

function toDto(row) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    slug: row.slug,
    categoryId: row.category_id,
    categoryName: row.category_name,
    flatMakingChargeDiscountPercent:
      row.flat_making_discount_percent == null ? 0 : Number(row.flat_making_discount_percent),
    flatStoneDiscountPercent:
      row.flat_stone_discount_percent == null ? 0 : Number(row.flat_stone_discount_percent),
    effectiveMakingChargeDiscountPercent:
      row.effective_making_charge_discount_percent == null ? null : Number(row.effective_making_charge_discount_percent),
    effectiveStoneDiscountPercent:
      row.effective_stone_discount_percent == null ? null : Number(row.effective_stone_discount_percent),
    effectiveMakingChargeRuleId: row.effective_making_charge_rule_id,
    effectiveStoneRuleId: row.effective_stone_rule_id,
    hasMakingOverride: row.has_making_override,
    hasStoneOverride: row.has_stone_override,
    hasRestorableOverride: row.has_restorable_override,
  };
}

export async function list(req, res, next) {
  try {
    const query = listProductOverridesQuerySchema.parse(req.query);
    const { page, limit, ...filters } = query;
    const { items, total } = await listProductOverrides(filters, { page, limit });
    res.json({ overrides: items.map(toDto), total, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function bulk(req, res, next) {
  try {
    const input = bulkOverrideActionSchema.parse(req.body);
    const result = await applyBulkOverrideAction(input, req.admin.id);
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
}
