import { query } from '../config/db.js';

const ALL_COLUMNS = `id, name, slug, description, is_active, created_at, updated_at`;

export async function listAllCollections({ activeOnly = false } = {}) {
  const { rows } = await query(
    `SELECT ${ALL_COLUMNS} FROM collections
     ${activeOnly ? 'WHERE is_active = true' : ''}
     ORDER BY name`,
  );
  return rows;
}

export async function searchCollections(term, limit = 5) {
  const { rows } = await query(
    `SELECT ${ALL_COLUMNS} FROM collections
     WHERE is_active = true AND name ILIKE '%' || $1 || '%'
     ORDER BY name LIMIT $2`,
    [term, limit],
  );
  return rows;
}

export async function findCollectionBySlug(slug) {
  const { rows } = await query(`SELECT ${ALL_COLUMNS} FROM collections WHERE slug = $1`, [slug]);
  return rows[0] ?? null;
}

export async function findCollectionById(id) {
  const { rows } = await query(`SELECT ${ALL_COLUMNS} FROM collections WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createCollection({ name, slug, description, isActive }) {
  const { rows } = await query(
    `INSERT INTO collections (name, slug, description, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING ${ALL_COLUMNS}`,
    [name, slug, description ?? null, isActive ?? true],
  );
  return rows[0];
}

const COLLECTION_COLUMNS = {
  name: 'name',
  slug: 'slug',
  description: 'description',
  isActive: 'is_active',
};

export async function updateCollection(id, fields) {
  const values = [id];
  const setClauses = [];
  for (const [key, column] of Object.entries(COLLECTION_COLUMNS)) {
    if (Object.hasOwn(fields, key)) {
      values.push(fields[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }
  if (setClauses.length === 0) return findCollectionById(id);

  setClauses.push('updated_at = now()');
  const { rows } = await query(
    `UPDATE collections SET ${setClauses.join(', ')} WHERE id = $1 RETURNING ${ALL_COLUMNS}`,
    values,
  );
  return rows[0] ?? null;
}

export async function deleteCollection(id) {
  await query('DELETE FROM collections WHERE id = $1', [id]);
}
