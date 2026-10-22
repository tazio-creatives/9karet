// 9karet Ring workflow: exactly four Yellow Gold catalogue views per
// reference — Hero three-quarter, Front/Top, Side profile, Macro detail, in
// that order. No rose gold and no hand shots for Ring any more.
//
// The old hand/rose slots stay valid asset types so images from jobs made
// before this change still load; they just move after the four new views.

const ASSET_TYPES = [
  'YELLOW_FRONT', 'YELLOW_HERO_45', 'ROSE_FRONT', 'ROSE_HERO_45',
  'PRESENTER_YELLOW_1', 'PRESENTER_YELLOW_2', 'PRESENTER_ROSE',
  'RING_GOLD_HERO', 'RING_GOLD_FRONT', 'RING_GOLD_SIDE', 'RING_GOLD_MACRO',
  'RING_HAND_1', 'RING_HAND_2', 'RING_ROSE_FRONT', 'RING_ROSE_SIDE',
];

const OLD_ASSET_TYPES = ASSET_TYPES.filter((t) => t !== 'RING_GOLD_HERO' && t !== 'RING_GOLD_MACRO');

const GENERIC_ORDER = `
  (asset_type = 'YELLOW_FRONT'       AND display_order = 0) OR
  (asset_type = 'YELLOW_HERO_45'     AND display_order = 1) OR
  (asset_type = 'ROSE_FRONT'         AND display_order = 2) OR
  (asset_type = 'ROSE_HERO_45'       AND display_order = 3) OR
  (asset_type = 'PRESENTER_YELLOW_1' AND display_order = 4) OR
  (asset_type = 'PRESENTER_YELLOW_2' AND display_order = 5) OR
  (asset_type = 'PRESENTER_ROSE'     AND display_order = 6)`;

const RING_ORDER_NEW = {
  RING_GOLD_HERO: 0,
  RING_GOLD_FRONT: 1,
  RING_GOLD_SIDE: 2,
  RING_GOLD_MACRO: 3,
  RING_HAND_1: 4,
  RING_HAND_2: 5,
  RING_ROSE_FRONT: 6,
  RING_ROSE_SIDE: 7,
};

const RING_ORDER_OLD = {
  RING_HAND_1: 0,
  RING_HAND_2: 1,
  RING_GOLD_FRONT: 2,
  RING_GOLD_SIDE: 3,
  RING_ROSE_FRONT: 4,
  RING_ROSE_SIDE: 5,
};

const list = (types) => types.map((t) => `'${t}'`).join(',');

const orderCheck = (ringOrder) =>
  [GENERIC_ORDER, ...Object.entries(ringOrder).map(([t, n]) => `(asset_type = '${t}' AND display_order = ${n})`)].join(
    ' OR\n  ',
  );

const renumber = (pgm, ringOrder) => {
  const cases = Object.entries(ringOrder)
    .map(([t, n]) => `WHEN '${t}' THEN ${n}`)
    .join(' ');
  pgm.sql(`
    UPDATE ai_studio_assets SET display_order = CASE asset_type ${cases} END
    WHERE asset_type IN (${list(Object.keys(ringOrder))});
  `);
};

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_asset_type_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_asset_type_check CHECK (asset_type IN (${list(ASSET_TYPES)}));`);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_display_order_check;`);
  renumber(pgm, RING_ORDER_NEW);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_display_order_check CHECK (${orderCheck(RING_ORDER_NEW)});`);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_is_featured_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_is_featured_check
      CHECK (NOT is_featured OR asset_type IN (
        'YELLOW_FRONT','YELLOW_HERO_45','ROSE_FRONT','ROSE_HERO_45',
        'RING_GOLD_HERO','RING_GOLD_FRONT','RING_GOLD_SIDE','RING_GOLD_MACRO',
        'RING_ROSE_FRONT','RING_ROSE_SIDE'
      ));
  `);
};

export const down = (pgm) => {
  pgm.sql(`DELETE FROM ai_studio_assets WHERE asset_type IN ('RING_GOLD_HERO','RING_GOLD_MACRO');`);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_is_featured_check;`);
  pgm.sql(`
    ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_is_featured_check
      CHECK (NOT is_featured OR asset_type IN (
        'YELLOW_FRONT','YELLOW_HERO_45','ROSE_FRONT','ROSE_HERO_45',
        'RING_GOLD_FRONT','RING_GOLD_SIDE','RING_ROSE_FRONT','RING_ROSE_SIDE'
      ));
  `);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_display_order_check;`);
  renumber(pgm, RING_ORDER_OLD);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_display_order_check CHECK (${orderCheck(RING_ORDER_OLD)});`);

  pgm.sql(`ALTER TABLE ai_studio_assets DROP CONSTRAINT ai_studio_assets_asset_type_check;`);
  pgm.sql(`ALTER TABLE ai_studio_assets ADD CONSTRAINT ai_studio_assets_asset_type_check CHECK (asset_type IN (${list(OLD_ASSET_TYPES)}));`);
};
