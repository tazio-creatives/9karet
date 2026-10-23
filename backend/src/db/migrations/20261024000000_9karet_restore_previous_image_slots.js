// Reverts the AI Studio image plan to the 2a4c359 workflow (Ring: hand
// shots + gold/rose front/side; other categories: yellow/rose catalogue +
// presenter shots) WITHOUT deleting anything: rows made with the four-view
// Ring set and the six-image standard set stay valid and readable. Only the
// old slots go back to the display order the restored code expects.

const ASSET_TYPES = [
  'YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45',
  'PRESENTER_YELLOW_1', 'PRESENTER_YELLOW_2', 'PRESENTER_ROSE',
  'RING_HAND_1', 'RING_HAND_2', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE',
  // No longer generated — kept for jobs made 22–23 Oct 2026.
  'RING_GOLD_HERO', 'RING_GOLD_MACRO',
  'GOLD_HERO', 'GOLD_FRONT', 'GOLD_SIDE', 'GOLD_MACRO', 'MODEL_1', 'MODEL_2',
];

const FEATURABLE = [
  'YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45',
  'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE',
  'RING_GOLD_HERO', 'RING_GOLD_MACRO', 'GOLD_HERO', 'GOLD_FRONT', 'GOLD_SIDE', 'GOLD_MACRO',
];

const GENERIC_ORDER = {
  YELLOW_FRONT: 0,
  YELLOW_HERO_45: 1,
  ROSE_FRONT: 2,
  ROSE_HERO_45: 3,
  PRESENTER_YELLOW_1: 4,
  PRESENTER_YELLOW_2: 5,
  PRESENTER_ROSE: 6,
  GOLD_HERO: 0,
  GOLD_FRONT: 1,
  GOLD_SIDE: 2,
  GOLD_MACRO: 3,
  MODEL_1: 4,
  MODEL_2: 5,
  RING_GOLD_HERO: 0,
  RING_GOLD_MACRO: 3,
};

// The restored code's Ring order, and the four-view order it replaces.
const RING_ORDER_RESTORED = {
  RING_HAND_1: 0,
  RING_HAND_2: 1,
  RING_GOLD_FRONT: 2,
  RING_GOLD_SIDE: 3,
  RING_ROSE_FRONT: 4,
  RING_ROSE_SIDE: 5,
};
const RING_ORDER_FOUR_VIEW = {
  RING_HAND_1: 4,
  RING_HAND_2: 5,
  RING_GOLD_FRONT: 1,
  RING_GOLD_SIDE: 2,
  RING_ROSE_FRONT: 6,
  RING_ROSE_SIDE: 7,
};

const list = (types) => types.map((t) => `'${t}'`).join(',');
const orderCheck = (order) =>
  Object.entries(order)
    .map(([t, n]) => `(asset_type = '${t}' AND display_order = ${n})`)
    .join(' OR\n  ');

const apply = (pgm, ringOrder) => {
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_display_order_check;`);
  const cases = Object.entries(ringOrder)
    .map(([t, n]) => `WHEN '${t}' THEN ${n}`)
    .join(' ');
  pgm.sql(`
    UPDATE ai_studio_assets SET display_order = CASE asset_type ${cases} END
    WHERE asset_type IN (${list(Object.keys(ringOrder))});
  `);
  pgm.sql(
    `ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_display_order_check CHECK (${orderCheck({ ...GENERIC_ORDER, ...ringOrder })});`,
  );
};

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_asset_type_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_asset_type_check CHECK (asset_type IN (${list(ASSET_TYPES)}));`);
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_is_featured_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_is_featured_check CHECK (NOT is_featured OR asset_type IN (${list(FEATURABLE)}));`);
  apply(pgm, RING_ORDER_RESTORED);
};

export const down = (pgm) => {
  apply(pgm, RING_ORDER_FOUR_VIEW);
};
