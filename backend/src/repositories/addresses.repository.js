import { query } from '../config/db.js';

export async function listAddressesByUser(userId) {
  const { rows } = await query(
    'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
    [userId],
  );
  return rows;
}

export async function findAddressById(id) {
  const { rows } = await query('SELECT * FROM addresses WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function countAddressesForUserTx(client, userId) {
  const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM addresses WHERE user_id = $1', [
    userId,
  ]);
  return rows[0].count;
}

export async function clearDefaultForUserTx(client, userId) {
  await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default = true', [
    userId,
  ]);
}

const COLUMNS = [
  'user_id',
  'type',
  'is_default',
  'name',
  'mobile_number',
  'address_line',
  'building',
  'landmark',
  'city',
  'state',
  'pincode',
  'country',
];

const FIELD_MAP = Object.fromEntries(
  COLUMNS.map((column) => [column.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), column]),
);

export async function createAddressTx(client, fields) {
  const columns = [];
  const placeholders = [];
  const values = [];
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (Object.hasOwn(fields, key)) {
      values.push(fields[key]);
      columns.push(column);
      placeholders.push(`$${values.length}`);
    }
  }
  const { rows } = await client.query(
    `INSERT INTO addresses (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values,
  );
  return rows[0];
}

export async function updateAddressTx(client, id, fields) {
  const values = [id];
  const setClauses = [];
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (key === 'userId') continue; // owner never changes via update
    if (Object.hasOwn(fields, key)) {
      values.push(fields[key]);
      setClauses.push(`${column} = $${values.length}`);
    }
  }
  if (setClauses.length === 0) {
    const { rows } = await client.query('SELECT * FROM addresses WHERE id = $1', [id]);
    return rows[0] ?? null;
  }
  setClauses.push('updated_at = now()');
  const { rows } = await client.query(
    `UPDATE addresses SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values,
  );
  return rows[0] ?? null;
}

export async function setDefaultTx(client, id) {
  await client.query('UPDATE addresses SET is_default = true WHERE id = $1', [id]);
}

export async function deleteAddress(id) {
  await query('DELETE FROM addresses WHERE id = $1', [id]);
}
