// 9karet: every non-Ring category gets the same fixed image set as Ring —
// four Yellow Gold catalogue views (GOLD_HERO / FRONT / SIDE / MACRO) and
// two AI-described model shots (MODEL_1 / MODEL_2). The older generic slots
// stay valid so jobs made before this change still load.

const OLD_ASSET_TYPES = [
  'YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45',
  'PRESENTER_YELLOW_1', 'PRESENTER_YELLOW_2', 'PRESENTER_ROSE',
  'RING_GOLD_HERO', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_GOLD_MACRO',
  'RING_HAND_1', 'RING_HAND_2', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE',
];
const NEW_TYPES = ['GOLD_HERO', 'GOLD_FRONT', 'GOLD_SIDE', 'GOLD_MACRO', 'MODEL_1', 'MODEL_2'];

const ORDER = {
  YELLOW_FRONT: 0,
  YELLOW_HERO_45: 1,
  ROSE_FRONT: 2,
  ROSE_HERO_45: 3,
  PRESENTER_YELLOW_1: 4,
  PRESENTER_YELLOW_2: 5,
  PRESENTER_ROSE: 6,
  RING_GOLD_HERO: 0,
  RING_GOLD_FRONT: 1,
  RING_GOLD_SIDE: 2,
  RING_GOLD_MACRO: 3,
  RING_HAND_1: 4,
  RING_HAND_2: 5,
  RING_ROSE_FRONT: 6,
  RING_ROSE_SIDE: 7,
};
const NEW_ORDER = { GOLD_HERO: 0, GOLD_FRONT: 1, GOLD_SIDE: 2, GOLD_MACRO: 3, MODEL_1: 4, MODEL_2: 5 };

const OLD_FEATURABLE = [
  'YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45',
  'RING_GOLD_HERO', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_GOLD_MACRO',
  'RING_ROSE_FRONT', 'RING_ROSE_SIDE',
];
const NEW_FEATURABLE = ['GOLD_HERO', 'GOLD_FRONT', 'GOLD_SIDE', 'GOLD_MACRO'];

const list = (types) => types.map((t) => `'${t}'`).join(',');
const orderCheck = (order) =>
  Object.entries(order)
    .map(([t, n]) => `(asset_type = '${t}' AND display_order = ${n})`)
    .join(' OR\n  ');

const setConstraints = (pgm, { types, order, featurable }) => {
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_asset_type_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_asset_type_check CHECK (asset_type IN (${list(types)}));`);
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_display_order_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_display_order_check CHECK (${orderCheck(order)});`);
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_is_featured_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_is_featured_check CHECK (NOT is_featured OR asset_type IN (${list(featurable)}));`);
};

export const up = (pgm) => {
  setConstraints(pgm, {
    types: [...OLD_ASSET_TYPES, ...NEW_TYPES],
    order: { ...ORDER, ...NEW_ORDER },
    featurable: [...OLD_FEATURABLE, ...NEW_FEATURABLE],
  });
};

export const down = (pgm) => {
  pgm.sql(`DELETE FROM ai_studio_assets WHERE asset_type IN (${list(NEW_TYPES)});`);
  setConstraints(pgm, { types: OLD_ASSET_TYPES, order: ORDER, featurable: OLD_FEATURABLE });
};
