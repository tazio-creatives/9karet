import { query } from '../config/db.js';

// Every attribute + its GLOBAL values only (product_id IS NULL) — Size
// values are product-scoped and managed from the product form itself, not
// here; this screen is for the shared catalogue (Purity, Gold Color, and
// any future attribute type).
export async function findAllAttributesWithGlobalValues() {
  const { rows } = await query(
    `SELECT a.id AS attribute_id, a.code, a.name, a.sort_order AS attribute_sort_order, a.is_active AS attribute_is_active,
            av.id AS value_id, av.value, av.label, av.ref_id, av.sort_order AS value_sort_order, av.is_active AS value_is_active
     FROM attributes a
     LEFT JOIN attribute_values av ON av.attribute_id = a.id AND av.product_id IS NULL
     ORDER BY a.sort_order, av.sort_order`,
  );
  const byId = new Map();
  for (const row of rows) {
    if (!byId.has(row.attribute_id)) {
      byId.set(row.attribute_id, {
        id: row.attribute_id,
        code: row.code,
        name: row.name,
        sortOrder: row.attribute_sort_order,
        isActive: row.attribute_is_active,
        values: [],
      });
    }
    if (row.value_id) {
      byId.get(row.attribute_id).values.push({
        id: row.value_id,
        value: row.value,
        label: row.label,
        refId: row.ref_id,
        sortOrder: row.value_sort_order,
        isActive: row.value_is_active,
      });
    }
  }
  return [...byId.values()];
}

export async function createAttribute({ code, name, sortOrder }) {
  const { rows } = await query(
    `INSERT INTO attributes (code, name, sort_order) VALUES ($1, $2, $3) RETURNING id`,
    [code, name, sortOrder ?? 0],
  );
  return rows[0].id;
}

export async function updateAttribute(id, { name, sortOrder, isActive }) {
  const values = [id];
  const setClauses = [];
  if (name !== undefined) {
    values.push(name);
    setClauses.push(`name = $${values.length}`);
  }
  if (sortOrder !== undefined) {
    values.push(sortOrder);
    setClauses.push(`sort_order = $${values.length}`);
  }
  if (isActive !== undefined) {
    values.push(isActive);
    setClauses.push(`is_active = $${values.length}`);
  }
  if (setClauses.length === 0) return;
  setClauses.push('updated_at = now()');
  await query(`UPDATE attributes SET ${setClauses.join(', ')} WHERE id = $1`, values);
}

export async function createGlobalAttributeValue(attributeId, { value, label, refId, sortOrder }) {
  const { rows } = await query(
    `INSERT INTO attribute_values (attribute_id, value, label, ref_id, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [attributeId, value, label, refId ?? null, sortOrder ?? 0],
  );
  return rows[0].id;
}

export async function updateAttributeValue(id, { label, sortOrder, isActive }) {
  const values = [id];
  const setClauses = [];
  if (label !== undefined) {
    values.push(label);
    setClauses.push(`label = $${values.length}`);
  }
  if (sortOrder !== undefined) {
    values.push(sortOrder);
    setClauses.push(`sort_order = $${values.length}`);
  }
  if (isActive !== undefined) {
    values.push(isActive);
    setClauses.push(`is_active = $${values.length}`);
  }
  if (setClauses.length === 0) return;
  setClauses.push('updated_at = now()');
  await query(`UPDATE attribute_values SET ${setClauses.join(', ')} WHERE id = $1`, values);
}
