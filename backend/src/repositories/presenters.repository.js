import { query } from '../config/db.js';

// Compact columns only — the 4 reference image URLs aren't needed for the
// Step 3 picker grid, only for the single-presenter "View References" fetch
// below (findPresenterById).
const LIST_COLUMNS = `
  id, display_name, style_label, main_preview_image_url, supported_jewellery_types, is_default
`;

export async function findActivePresenters({ jewelleryType } = {}) {
  const params = [];
  let where = 'WHERE is_active = true';
  if (jewelleryType) {
    params.push(jewelleryType);
    where += ` AND $${params.length} = ANY(supported_jewellery_types)`;
  }
  const { rows } = await query(
    `SELECT ${LIST_COLUMNS} FROM presenters ${where} ORDER BY display_order, display_name`,
    params,
  );
  return rows;
}

// Not filtered by is_active — a job that already picked a since-deactivated
// presenter must still be able to render it (job detail, generation, review).
export async function findPresenterById(id) {
  const { rows } = await query('SELECT * FROM presenters WHERE id = $1', [id]);
  return rows[0] ?? null;
}
